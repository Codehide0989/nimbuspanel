import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getNavForRole } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ConsoleClient } from "./client";

export default async function ConsolePage() {
  const user = await requireAuth();

  // Permission check: only Owner, Admin, SSH_USER can access
  if (!hasPermission(user.role, "vps:ssh")) {
    redirect("/dashboard");
  }

  const nav = getNavForRole(user.role);

  let servers: Array<{ id: string; displayName: string; publicIp: string; status: string; username: string; hostname: string | null }> = [];

  try {
    const vps = await db.vps.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { displayName: "asc" },
    });
    servers = vps.map((v) => ({
      id: v.id,
      displayName: v.displayName,
      publicIp: v.publicIp,
      status: v.status,
      username: v.username,
      hostname: v.hostname,
    }));
  } catch { /* DB error */ }

  return (
    <ConsoleClient
      servers={servers}
      nav={nav}
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
    />
  );
}
