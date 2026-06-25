import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getNavForRole } from "@/lib/navigation";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const user = await requireAuth();
  const nav = getNavForRole(user.role);

  // Single optimized query — select only needed fields
  let servers: Array<{
    id: string;
    displayName: string;
    publicIp: string;
    status: string;
    provider: string;
    os: string;
    osName: string | null;
    osVersion: string | null;
    hostname: string | null;
    username: string;
    sshPort: number;
    cpuCores: number | null;
    ramTotalMb: number | null;
    diskTotalGb: number | null;
    diskUsedGb: number | null;
    diskFreeGb: number | null;
    arch: string | null;
    kernel: string | null;
    uptime: string | null;
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
        provider: true, os: true, osName: true, osVersion: true,
        hostname: true, username: true, sshPort: true,
        cpuCores: true, ramTotalMb: true, diskTotalGb: true,
        diskUsedGb: true, diskFreeGb: true, arch: true, kernel: true,
        uptime: true, environment: true, lastSeenAt: true, createdAt: true,
      },
    });
    servers = vps.map((v) => ({
      ...v,
      lastSeenAt: v.lastSeenAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  } catch { /* DB error */ }

  return (
    <DashboardClient
      servers={servers}
      nav={nav}
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
    />
  );
}
