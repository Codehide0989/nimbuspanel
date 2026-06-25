import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getNavForRole } from "@/lib/navigation";
import { notFound } from "next/navigation";
import { ServerDetailClient } from "./client";

interface Props {
  params: { id: string };
}

export default async function ServerDetailPage({ params }: Props) {
  const user = await requireAuth();
  const nav = getNavForRole(user.role);

  const vps = await db.vps.findFirst({
    where: { id: params.id, workspaceId: user.workspaceId },
  });

  if (!vps) notFound();

  return (
    <ServerDetailClient
      server={{
        id: vps.id,
        displayName: vps.displayName,
        publicIp: vps.publicIp,
        sshPort: vps.sshPort,
        username: vps.username,
        status: vps.status,
        provider: vps.provider,
        os: vps.os,
        environment: vps.environment,
        notes: vps.notes,
        hostname: vps.hostname,
        kernel: vps.kernel,
        arch: vps.arch,
        cpuCores: vps.cpuCores,
        ramTotalMb: vps.ramTotalMb,
        diskTotalGb: vps.diskTotalGb,
        diskUsedGb: vps.diskUsedGb,
        diskFreeGb: vps.diskFreeGb,
        filesystem: vps.filesystem,
        privateIp: vps.privateIp,
        osName: vps.osName,
        osVersion: vps.osVersion,
        uptime: vps.uptime,
        lastSeenAt: vps.lastSeenAt?.toISOString() ?? null,
        createdAt: vps.createdAt.toISOString(),
      }}
      nav={nav}
      user={{ name: user.name, email: user.email, workspaceName: user.workspaceName }}
    />
  );
}
