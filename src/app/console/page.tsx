import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getNavForRole } from "@/lib/navigation";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ConsoleClient } from "./client";

export default async function ConsolePage() {
  const user = await requireAuth();

  if (!hasPermission(user.role, "vps:ssh")) {
    redirect("/dashboard");
  }

  const nav = getNavForRole(user.role);
  const sessionToken = cookies().get("nimbus_session")?.value ?? "";

  let servers: Array<{ id: string; displayName: string; publicIp: string; status: string; username: string; hostname: string | null }> = [];

  try {
    const vps = await db.vps.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, publicIp: true, status: true, username: true, hostname: true },
    });
    servers = vps;
  } catch { /* DB error */ }

  return (
    <ConsoleClient
      servers={servers}
      sessionToken={sessionToken}
      nav={nav}
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
    />
  );
}
