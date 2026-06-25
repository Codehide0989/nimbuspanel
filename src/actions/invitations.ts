"use server";

import { db } from "@/lib/db";
import { sendInvitationEmail, sendRoleChangedEmail } from "@/lib/resend";
import { logActivity } from "@/lib/audit";
import { inviteUserSchema } from "@/lib/validators";
import { generateToken } from "@/lib/utils";
import { getRoleLabel } from "@/lib/permissions";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { Role } from "@prisma/client";

function generateTempPassword(): string {
  // 12 chars: mix of alphanumeric + special
  return randomBytes(9).toString("base64").slice(0, 12);
}

export async function inviteUser(input: unknown) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };

  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, role } = parsed.data;
  const workspaceId = authUser.workspaceId;

  try {
    // Check if already a member
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await db.teamMember.findUnique({
        where: { userId_workspaceId: { userId: existingUser.id, workspaceId } },
      });
      if (existingMember) return { error: "User is already a member of this workspace" };
    }

    // Check for existing pending invite
    const existingInvite = await db.invitation.findFirst({
      where: { email, workspaceId, status: "PENDING" },
    });
    if (existingInvite) return { error: "An invitation is already pending for this email. Use Resend." };

    const token = generateToken(48);
    const tempPassword = generateTempPassword();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save invitation with temp password
    const invitation = await db.invitation.create({
      data: {
        email,
        role,
        token,
        tempPassword,
        expiresAt,
        invitedById: authUser.id,
        workspaceId,
      },
    });

    // Get workspace name for email
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
    const inviterName = authUser.name ?? authUser.email;
    const workspaceName = workspace?.name ?? "NimbusPanel";

    // Send email — do NOT silently ignore failure
    const emailResult = await sendInvitationEmail({
      to: email,
      inviterName,
      workspaceName,
      role: getRoleLabel(role),
      inviteToken: token,
      tempPassword,
      expiresAt,
    });

    if (!emailResult.success) {
      // Keep invitation in DB but report the email failure
      console.error("[inviteUser] Email failed:", emailResult.error);
      await logActivity({
        action: "user.invited",
        userId: authUser.id,
        workspaceId,
        target: email,
        metadata: JSON.parse(JSON.stringify({ role, emailStatus: "failed", error: emailResult.error })),
      });
      revalidatePath("/users");
      return {
        data: invitation,
        warning: `Invitation created but email delivery failed: ${emailResult.error}. The user can still be invited manually.`,
      };
    }

    await logActivity({
      action: "user.invited",
      userId: authUser.id,
      workspaceId,
      target: email,
      metadata: JSON.parse(JSON.stringify({ role, emailStatus: "sent" })),
    });

    revalidatePath("/users");
    return { data: invitation };
  } catch (error) {
    console.error("[inviteUser]", error);
    return { error: `Failed to create invitation: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function resendInvitation(invitationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };

  try {
    const invitation = await db.invitation.findUnique({
      where: { id: invitationId },
      include: { workspace: true },
    });
    if (!invitation) return { error: "Invitation not found" };
    if (invitation.status !== "PENDING") return { error: "Can only resend pending invitations" };

    // Generate new temp password
    const tempPassword = generateTempPassword();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.invitation.update({
      where: { id: invitationId },
      data: { tempPassword, expiresAt: newExpiresAt },
    });

    const inviterName = authUser.name ?? authUser.email;

    const emailResult = await sendInvitationEmail({
      to: invitation.email,
      inviterName,
      workspaceName: invitation.workspace.name,
      role: getRoleLabel(invitation.role),
      inviteToken: invitation.token,
      tempPassword,
      expiresAt: newExpiresAt,
    });

    if (!emailResult.success) {
      return { error: `Resend failed: ${emailResult.error}` };
    }

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("[resendInvitation]", error);
    return { error: "Failed to resend invitation" };
  }
}

export async function revokeInvitation(invitationId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };

  try {
    await db.invitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });
    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("[revokeInvitation]", error);
    return { error: "Failed to revoke invitation" };
  }
}

export async function acceptInvitation(token: string) {
  try {
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) return { error: "Invitation not found" };
    if (invitation.status !== "PENDING") return { error: "This invitation has already been used" };
    if (new Date() > invitation.expiresAt) {
      await db.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      return { error: "This invitation has expired" };
    }

    let user = await db.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      const passwordHash = await hashPassword(invitation.tempPassword ?? generateTempPassword());
      user = await db.user.create({
        data: { email: invitation.email, passwordHash, mustChangePass: true },
      });
    }

    // Add to workspace (upsert to handle edge cases)
    await db.teamMember.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: invitation.workspaceId } },
      update: { role: invitation.role },
      create: { userId: user.id, workspaceId: invitation.workspaceId, role: invitation.role },
    });

    await db.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED" } });

    await logActivity({
      action: "invitation.accepted",
      userId: user.id,
      workspaceId: invitation.workspaceId,
      target: invitation.email,
    });

    return { data: { workspaceSlug: invitation.workspace.slug } };
  } catch (error) {
    console.error("[acceptInvitation]", error);
    return { error: "Failed to accept invitation" };
  }
}

// ─── Role Management ────────────────────────────────────────────────

export async function changeUserRole(memberId: string, newRole: Role) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };
  if (authUser.role !== "OWNER" && authUser.role !== "ADMIN") {
    return { error: "Only Owner and Admin can change roles" };
  }

  try {
    const member = await db.teamMember.findUnique({
      where: { id: memberId },
      include: { user: true, workspace: true },
    });
    if (!member) return { error: "Member not found" };

    // Cannot change the last owner
    if (member.role === "OWNER" && newRole !== "OWNER") {
      const ownerCount = await db.teamMember.count({
        where: { workspaceId: member.workspaceId, role: "OWNER" },
      });
      if (ownerCount <= 1) return { error: "Cannot remove the last Owner. Transfer ownership first." };
    }

    // Only Owner can promote to Owner
    if (newRole === "OWNER" && authUser.role !== "OWNER") {
      return { error: "Only the current Owner can transfer ownership" };
    }

    await db.teamMember.update({ where: { id: memberId }, data: { role: newRole } });

    // Invalidate user sessions to force permission refresh
    await db.session.deleteMany({ where: { userId: member.userId } });

    // Send notification email
    await sendRoleChangedEmail({
      to: member.user.email,
      workspaceName: member.workspace.name,
      newRole: getRoleLabel(newRole),
    });

    await logActivity({
      action: "user.role_changed",
      userId: authUser.id,
      workspaceId: member.workspaceId,
      target: member.user.email,
      metadata: JSON.parse(JSON.stringify({ from: member.role, to: newRole })),
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    console.error("[changeUserRole]", error);
    return { error: "Failed to change role" };
  }
}

export async function disableUser(memberId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };
  if (authUser.role !== "OWNER" && authUser.role !== "ADMIN") return { error: "Permission denied" };

  try {
    const member = await db.teamMember.findUnique({ where: { id: memberId }, include: { user: true } });
    if (!member) return { error: "Member not found" };
    if (member.user.id === authUser.id) return { error: "Cannot disable your own account" };

    await db.user.update({ where: { id: member.userId }, data: { isActive: false } });
    await db.session.deleteMany({ where: { userId: member.userId } });

    await logActivity({
      action: "user.disabled",
      userId: authUser.id,
      workspaceId: authUser.workspaceId,
      target: member.user.email,
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return { error: "Failed to disable account" };
  }
}

export async function enableUser(memberId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };
  if (authUser.role !== "OWNER" && authUser.role !== "ADMIN") return { error: "Permission denied" };

  try {
    const member = await db.teamMember.findUnique({ where: { id: memberId }, include: { user: true } });
    if (!member) return { error: "Member not found" };

    await db.user.update({ where: { id: member.userId }, data: { isActive: true } });

    await logActivity({
      action: "user.enabled",
      userId: authUser.id,
      workspaceId: authUser.workspaceId,
      target: member.user.email,
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return { error: "Failed to enable account" };
  }
}

export async function removeMember(memberId: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };
  if (authUser.role !== "OWNER" && authUser.role !== "ADMIN") return { error: "Permission denied" };

  try {
    const member = await db.teamMember.findUnique({ where: { id: memberId }, include: { user: true } });
    if (!member) return { error: "Member not found" };
    if (member.user.id === authUser.id) return { error: "Cannot remove yourself" };

    // Cannot remove last owner
    if (member.role === "OWNER") {
      const ownerCount = await db.teamMember.count({ where: { workspaceId: member.workspaceId, role: "OWNER" } });
      if (ownerCount <= 1) return { error: "Cannot remove the last Owner" };
    }

    await db.teamMember.delete({ where: { id: memberId } });
    await db.session.deleteMany({ where: { userId: member.userId } });

    await logActivity({
      action: "user.removed",
      userId: authUser.id,
      workspaceId: authUser.workspaceId,
      target: member.user.email,
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    return { error: "Failed to remove member" };
  }
}
