"use server";

import { db } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/resend";
import { logActivity } from "@/lib/audit";
import { inviteUserSchema } from "@/lib/validators";
import { generateToken } from "@/lib/utils";
import { getRoleLabel } from "@/lib/permissions";
import { getAuthUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function inviteUser(input: unknown, _inviterId?: string) {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };

  const inviterId = authUser.id;
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, role } = parsed.data;
  const workspaceId = authUser.workspaceId;

  try {
    // Check if user is already a member
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await db.teamMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: existingUser.id,
            workspaceId,
          },
        },
      });
      if (existingMember) {
        return { error: "User is already a member of this workspace" };
      }
    }

    // Check for pending invitation
    const existingInvite = await db.invitation.findFirst({
      where: {
        email,
        workspaceId,
        status: "PENDING",
      },
    });
    if (existingInvite) {
      return { error: "An invitation is already pending for this email" };
    }

    const token = generateToken(48);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await db.invitation.create({
      data: {
        email,
        role,
        token,
        expiresAt,
        invitedById: inviterId,
        workspaceId,
      },
    });

    // Get inviter and workspace info for email
    const inviter = await db.user.findUnique({ where: { id: inviterId } });
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });

    if (inviter && workspace) {
      await sendInvitationEmail({
        to: email,
        inviterName: inviter.name ?? inviter.email,
        workspaceName: workspace.name,
        role: getRoleLabel(role),
        inviteToken: token,
      });
    }

    await logActivity({
      action: "user.invited",
      userId: inviterId,
      workspaceId,
      target: email,
      metadata: { role },
    });

    revalidatePath("/users");
    return { data: invitation };
  } catch (error) {
    console.error("[inviteUser]", error);
    return { error: "Failed to send invitation" };
  }
}

export async function acceptInvitation(token: string) {
  try {
    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invitation) {
      return { error: "Invitation not found" };
    }

    if (invitation.status !== "PENDING") {
      return { error: "This invitation has already been used" };
    }

    if (new Date() > invitation.expiresAt) {
      await db.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return { error: "This invitation has expired" };
    }

    // Find or create user
    let user = await db.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      // Create user with temp password from invitation
      const { hashPassword } = await import("@/lib/auth");
      const tempPass = invitation.tempPassword ?? "changeme123";
      const passwordHash = await hashPassword(tempPass);

      user = await db.user.create({
        data: { email: invitation.email, passwordHash, mustChangePass: true },
      });
    }

    // Add to workspace
    await db.teamMember.create({
      data: {
        userId: user.id,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });

    // Mark invitation accepted
    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

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

export async function revokeInvitation(invitationId: string) {
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
