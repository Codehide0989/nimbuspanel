"use server";

import { db, withRetry } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { testSSHConnection, collectServerInfo } from "@/lib/ssh";
import { getPresignedUrl, deleteFromS3 } from "@/lib/s3";
import { requireAuthAction, sanitizeError } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createServerSchema = z.object({
  displayName: z.string().min(1, "Server name is required").max(100),
  publicIp: z.string().min(7, "Public IP is required"),
  sshPort: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  pemKeyS3Key: z.string().min(1, "PEM key is required"),
  os: z.string().default("ubuntu"),
  provider: z.string().default("other"),
  environment: z.string().default("production"),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
});

/**
 * Test SSH connection to a server.
 */
export async function testSSH(input: {
  host: string;
  port: number;
  username: string;
  pemKeyS3Key: string;
}) {
  await requireAuthAction();

  try {
    const pemUrl = await getPresignedUrl(input.pemKeyS3Key, 60);
    const pemResponse = await fetch(pemUrl);
    if (!pemResponse.ok) {
      return { success: false, message: "Failed to retrieve PEM key from storage" };
    }
    const privateKey = await pemResponse.text();

    if (!privateKey.includes("PRIVATE KEY")) {
      return { success: false, message: "Invalid PEM file — does not contain a private key" };
    }

    const result = await testSSHConnection({
      host: input.host,
      port: input.port,
      username: input.username,
      privateKey,
    });

    return result;
  } catch (error) {
    console.error("[testSSH]", error);
    return { success: false, message: error instanceof Error ? error.message : "SSH test failed" };
  }
}

/**
 * Create a new manual VPS server.
 * Requires PEM upload + SSH test passed.
 * Automatically collects server system info via SSH.
 */
export async function createServer(input: unknown) {
  const authUser = await requireAuthAction();

  const parsed = createServerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const data = parsed.data;

  try {
    // Collect system info via SSH
    const pemUrl = await getPresignedUrl(data.pemKeyS3Key, 60);
    const pemResponse = await fetch(pemUrl);
    let systemInfo = null;

    if (pemResponse.ok) {
      const privateKey = await pemResponse.text();
      systemInfo = await collectServerInfo({
        host: data.publicIp,
        port: data.sshPort,
        username: data.username,
        privateKey,
      });
    }

    // Create server record with collected metadata
    const vps = await withRetry(() =>
      db.vps.create({
        data: {
          displayName: data.displayName,
          publicIp: data.publicIp,
          sshPort: data.sshPort,
          username: data.username,
          pemKeyS3Key: data.pemKeyS3Key,
          status: "online",
          provider: data.provider,
          os: data.os,
          environment: data.environment,
          notes: data.notes,
          tags: data.tags,
          // System info from SSH
          hostname: systemInfo?.hostname,
          kernel: systemInfo?.kernel,
          arch: systemInfo?.arch,
          cpuCores: systemInfo?.cpuCores,
          ramTotalMb: systemInfo?.ramTotalMb,
          diskTotalGb: systemInfo?.diskTotalGb,
          diskUsedGb: systemInfo?.diskUsedGb,
          diskFreeGb: systemInfo?.diskFreeGb,
          filesystem: systemInfo?.filesystem,
          privateIp: systemInfo?.privateIp,
          osName: systemInfo?.osName,
          osVersion: systemInfo?.osVersion,
          uptime: systemInfo?.uptime,
          lastSeenAt: new Date(),
          workspaceId: authUser.workspaceId,
        },
      })
    );

    await logActivity({
      action: "vps.created",
      userId: authUser.id,
      workspaceId: authUser.workspaceId,
      target: vps.displayName,
      metadata: JSON.parse(JSON.stringify({ ip: data.publicIp, provider: data.provider })),
    });

    revalidatePath("/dashboard");
    revalidatePath("/servers");
    return { data: { id: vps.id } };
  } catch (error) {
    console.error("[createServer]", error);
    return { error: sanitizeError(error) };
  }
}

/**
 * Refresh server system info by re-running SSH collection.
 */
export async function refreshServerInfo(serverId: string) {
  const authUser = await requireAuthAction();

  try {
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: authUser.workspaceId },
    });
    if (!vps) return { error: "Server not found" };

    const pemUrl = await getPresignedUrl(vps.pemKeyS3Key, 60);
    const pemResponse = await fetch(pemUrl);
    if (!pemResponse.ok) return { error: "Cannot retrieve PEM key" };

    const privateKey = await pemResponse.text();
    const info = await collectServerInfo({
      host: vps.publicIp,
      port: vps.sshPort,
      username: vps.username,
      privateKey,
    });

    await db.vps.update({
      where: { id: serverId },
      data: {
        status: "online",
        hostname: info.hostname,
        kernel: info.kernel,
        arch: info.arch,
        cpuCores: info.cpuCores,
        ramTotalMb: info.ramTotalMb,
        diskTotalGb: info.diskTotalGb,
        diskUsedGb: info.diskUsedGb,
        diskFreeGb: info.diskFreeGb,
        filesystem: info.filesystem,
        privateIp: info.privateIp,
        osName: info.osName,
        osVersion: info.osVersion,
        uptime: info.uptime,
        lastSeenAt: new Date(),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/servers");
    return { success: true };
  } catch (error) {
    // Mark as offline if SSH fails
    await db.vps.update({ where: { id: serverId }, data: { status: "offline" } }).catch(() => {});
    console.error("[refreshServerInfo]", error);
    return { error: "Failed to connect to server" };
  }
}

/**
 * Delete a server and clean up PEM from S3.
 */
export async function deleteServer(serverId: string) {
  const authUser = await requireAuthAction();

  try {
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: authUser.workspaceId },
    });
    if (!vps) return { error: "Server not found" };

    // Clean up PEM key from S3
    if (vps.pemKeyS3Key) {
      try { await deleteFromS3(vps.pemKeyS3Key); } catch { /* best effort */ }
    }

    await db.vps.delete({ where: { id: serverId } });

    await logActivity({
      action: "vps.deleted",
      userId: authUser.id,
      workspaceId: authUser.workspaceId,
      target: vps.displayName,
    });

    revalidatePath("/dashboard");
    revalidatePath("/servers");
    return { success: true };
  } catch (error) {
    console.error("[deleteServer]", error);
    return { error: "Failed to delete server" };
  }
}

/**
 * Execute an SSH command on a server (start/stop/reboot).
 */
async function executeSSHCommand(serverId: string, command: string, actionName: string) {
  const authUser = await requireAuthAction();

  try {
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: authUser.workspaceId },
    });
    if (!vps) return { error: "Server not found" };

    const pemUrl = await getPresignedUrl(vps.pemKeyS3Key, 60);
    const pemResponse = await fetch(pemUrl);
    if (!pemResponse.ok) return { error: "Cannot retrieve PEM key" };
    const privateKey = await pemResponse.text();

    const { NodeSSH } = await import("node-ssh");
    const ssh = new NodeSSH();

    await ssh.connect({
      host: vps.publicIp,
      port: vps.sshPort,
      username: vps.username,
      privateKey,
      readyTimeout: 10000,
    });

    await ssh.execCommand(command);
    ssh.dispose();

    // Update status based on action
    const statusMap: Record<string, string> = {
      start: "online",
      stop: "offline",
      reboot: "online",
    };

    await db.vps.update({
      where: { id: serverId },
      data: {
        status: statusMap[actionName] ?? vps.status,
        lastSeenAt: new Date(),
      },
    });

    await logActivity({
      action: `vps.${actionName}` as "vps.created" | "vps.deleted",
      userId: authUser.id,
      workspaceId: authUser.workspaceId,
      target: vps.displayName,
    });

    revalidatePath("/dashboard");
    revalidatePath("/servers");
    return { success: true };
  } catch (error) {
    console.error(`[${actionName}Server]`, error);
    const msg = error instanceof Error ? error.message : `Failed to ${actionName} server`;
    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) {
      await db.vps.update({ where: { id: serverId }, data: { status: "offline" } }).catch(() => {});
    }
    return { error: msg.includes("ECONNREFUSED") ? "Server is unreachable" : msg.includes("ETIMEDOUT") ? "Connection timed out" : `Failed to ${actionName} server` };
  }
}

export async function startServer(serverId: string) {
  return executeSSHCommand(serverId, "sudo systemctl start --all 2>/dev/null || echo started", "start");
}

export async function stopServer(serverId: string) {
  return executeSSHCommand(serverId, "sudo systemctl poweroff", "stop");
}

export async function rebootServer(serverId: string) {
  return executeSSHCommand(serverId, "sudo reboot", "reboot");
}

// Legacy exports for backward compatibility
export const createVps = createServer;
export const deleteVps = (id: string) => deleteServer(id);
export async function performVpsAction() { return { error: "Use SSH actions directly for manual VPS" }; }
export async function syncInstances() { return { error: "Manual VPS only — no AWS sync." }; }
export async function syncAwsInstances() { return { error: "Manual VPS only — no AWS sync." }; }
