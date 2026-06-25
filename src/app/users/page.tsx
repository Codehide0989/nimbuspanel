import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getNavForRole } from "@/lib/navigation";
import { UsersClient } from "./client";

export default async function UsersPage() {
  const user = await requireAuth();
  const nav = getNavForRole(user.role);

  let members: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    joinedAt: string;
  }> = [];

  let invitations: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    expiresAt: string;
  }> = [];

  try {
    const teamMembers = await db.teamMember.findMany({
      where: { workspaceId: user.workspaceId },
      include: { user: true },
      orderBy: { joinedAt: "desc" },
    });
    members = teamMembers.map((m) => ({
      id: m.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));

    const invites = await db.invitation.findMany({
      where: { workspaceId: user.workspaceId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    invitations = invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    }));
  } catch {
    // DB error
  }

  return (
    <UsersClient
      members={members}
      invitations={invitations}
      nav={nav}
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
    />
  );
}
