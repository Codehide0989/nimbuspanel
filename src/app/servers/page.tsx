import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getNavForRole } from "@/lib/navigation";
import { ServersClient } from "./client";

export default async function ServersPage() {
  const user = await requireAuth();
  const nav = getNavForRole(user.role);

  let servers: Array<{
    id: string;
    displayName: string;
    publicIp: string;
    status: string;
    provider: string;
    os: string;
    hostname: string | null;
    username: string;
    sshPort: number;
    cpuCores: number | null;
    ramTotalMb: number | null;
    diskTotalGb: number | null;
    diskUsedGb: number | null;
    environment: string;
    lastSeenAt: string | null;
    createdAt: string;
  }> = [];

  try {
    const vps = await db.vps.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, displayName: true, publicIp: true, status: true,
        provider: true, os: true, hostname: true, username: true,
        sshPort: true, cpuCores: true, ramTotalMb: true,
        diskTotalGb: true, diskUsedGb: true, environment: true,
        lastSeenAt: true, createdAt: true,
      },
    });
    servers = vps.map((v) => ({
      ...v,
      lastSeenAt: v.lastSeenAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  } catch { /* DB error */ }

  return <ServersClient servers={servers} nav={nav} user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }} />;
}
