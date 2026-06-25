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
    isActive: boolean;
    joinedAt: string;
    lastLoginAt: string | null;
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
    const [teamMembers, invites] = await Promise.all([
      db.teamMember.findMany({
        where: { workspaceId: user.workspaceId },
        include: { user: { select: { email: true, name: true, isActive: true, lastLoginAt: true } } },
        orderBy: { joinedAt: "desc" },
      }),
      db.invitation.findMany({
        where: { workspaceId: user.workspaceId, status: { in: ["PENDING", "EXPIRED"] } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    members = teamMembers.map((m) => ({
      id: m.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      isActive: m.user.isActive,
      joinedAt: m.joinedAt.toISOString(),
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
    }));

    invitations = invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    }));
  } catch { /* DB error */ }

  return (
    <UsersClient
      members={members}
      invitations={invitations}
      currentUserRole={user.role}
      nav={nav}
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
    />
  );
}
