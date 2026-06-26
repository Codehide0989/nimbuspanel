"use server";

import { db, withRetry } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { testSSHConnection, collectServerInfo, type SSHCredentials } from "@/lib/ssh";
import { getPresignedUrl, deleteFromS3 } from "@/lib/s3";
import { encrypt, decrypt } from "@/lib/crypto";
import { requireAuthAction, sanitizeError } from "@/lib/security";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createServerSchema = z.object({
  displayName: z.string().min(1, "Server name is required").max(100),
  publicIp: z.string().min(1, "Public IP or domain is required"),
  sshPort: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  authMethod: z.enum(["key", "password"]),
  // Key auth
  pemKeyS3Key: z.string().optional(),
  keyPassphrase: z.string().optional(),
  // Password auth
  password: z.string().optional(),
  // Metadata
  provider: z.string().default("other"),
  os: z.string().default("ubuntu"),
  environment: z.string().default("production"),
  notes: z.string().max(1000).optional(),
  tags: z.array(z.string()).default([]),
});

/**
 * Build SSH credentials for a VPS record, decrypting secrets as needed.
 */
async function getSSHCreds(vps: {
  publicIp: string; sshPort: number; username: string;
  authMethod: string; pemKeyS3Key: string | null;
  passwordEnc: string | null; keyPassphrase: string | null;
}): Promise<SSHCredentials> {
  const creds: SSHCredentials = {
    host: vps.publicIp,
    port: vps.sshPort,
    username: vps.username,
    authMethod: vps.authMethod as "key" | "password",
  };

  if (vps.authMethod === "password" && vps.passwordEnc) {
    creds.password = decrypt(vps.passwordEnc);
  } else if (vps.authMethod === "key" && vps.pemKeyS3Key) {
    const pemUrl = await getPresignedUrl(vps.pemKeyS3Key, 60);
    const resp = await fetch(pemUrl);
    if (resp.ok) creds.privateKey = await resp.text();
    if (vps.keyPassphrase) creds.passphrase = decrypt(vps.keyPassphrase);
  }

  return creds;
}

/**
 * Test SSH connection to a server (supports both key and password).
 */
export async function testSSH(input: {
  host: string;
  port: number;
  username: string;
  authMethod: "key" | "password";
  pemKeyS3Key?: string;
  keyPassphrase?: string;
  password?: string;
}) {
  await requireAuthAction();

  const creds: SSHCredentials = {
    host: input.host,
    port: input.port,
    username: input.username,
    authMethod: input.authMethod,
  };

  try {
    if (input.authMethod === "password") {
      if (!input.password) return { success: false, message: "Password is required" };
      creds.password = input.password;
    } else {
      if (!input.pemKeyS3Key) return { success: false, message: "Private key is required" };
      const pemUrl = await getPresignedUrl(input.pemKeyS3Key, 60);
      const resp = await fetch(pemUrl);
      if (!resp.ok) return { success: false, message: "Cannot retrieve key from storage" };
      creds.privateKey = await resp.text();
      if (input.keyPassphrase) creds.passphrase = input.keyPassphrase;
    }

    return await testSSHConnection(creds);
  } catch (error) {
    console.error("[testSSH]", error);
    return { success: false, message: error instanceof Error ? error.message : "SSH test failed" };
  }
}

/**
 * Create a new server — supports both key and password authentication.
 */
export async function createServer(input: unknown) {
  const authUser = await requireAuthAction();

  const parsed = createServerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;

  // Validate auth credentials present
  if (data.authMethod === "password" && !data.password) {
    return { error: "Password is required for password authentication" };
  }
  if (data.authMethod === "key" && !data.pemKeyS3Key) {
    return { error: "Private key is required for key authentication" };
  }

  try {
    // Build creds for system info collection
    const creds: SSHCredentials = {
      host: data.publicIp,
      port: data.sshPort,
      username: data.username,
      authMethod: data.authMethod,
    };

    if (data.authMethod === "password") {
      creds.password = data.password;
    } else if (data.pemKeyS3Key) {
      const pemUrl = await getPresignedUrl(data.pemKeyS3Key, 60);
      const resp = await fetch(pemUrl);
      if (resp.ok) creds.privateKey = await resp.text();
      if (data.keyPassphrase) creds.passphrase = data.keyPassphrase;
    }

    // Collect system info
    const systemInfo = await collectServerInfo(creds);

    // Encrypt sensitive credentials before storage
    const passwordEnc = data.authMethod === "password" && data.password ? encrypt(data.password) : null;
    const keyPassphraseEnc = data.keyPassphrase ? encrypt(data.keyPassphrase) : null;

    const vps = await withRetry(() =>
      db.vps.create({
        data: {
          displayName: data.displayName,
          publicIp: data.publicIp,
          sshPort: data.sshPort,
          username: data.username,
          authMethod: data.authMethod,
          pemKeyS3Key: data.authMethod === "key" ? data.pemKeyS3Key : null,
          passwordEnc,
          keyPassphrase: keyPassphraseEnc,
          status: "online",
          provider: data.provider,
          os: data.os,
          environment: data.environment,
          notes: data.notes,
          tags: data.tags,
          hostname: systemInfo.hostname,
          kernel: systemInfo.kernel,
          arch: systemInfo.arch,
          cpuCores: systemInfo.cpuCores,
          ramTotalMb: systemInfo.ramTotalMb,
          diskTotalGb: systemInfo.diskTotalGb,
          diskUsedGb: systemInfo.diskUsedGb,
          diskFreeGb: systemInfo.diskFreeGb,
          filesystem: systemInfo.filesystem,
          privateIp: systemInfo.privateIp,
          osName: systemInfo.osName,
          osVersion: systemInfo.osVersion,
          uptime: systemInfo.uptime,
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
      metadata: JSON.parse(JSON.stringify({ ip: data.publicIp, provider: data.provider, auth: data.authMethod })),
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
 * Refresh server system info via SSH.
 */
export async function refreshServerInfo(serverId: string) {
  const authUser = await requireAuthAction();

  try {
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: authUser.workspaceId },
    });
    if (!vps) return { error: "Server not found" };

    const creds = await getSSHCreds(vps);
    const info = await collectServerInfo(creds);

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
  } catch {
    await db.vps.update({ where: { id: serverId }, data: { status: "offline" } }).catch(() => {});
    return { error: "Failed to connect to server" };
  }
}

/**
 * Delete a server and clean up credentials.
 */
export async function deleteServer(serverId: string) {
  const authUser = await requireAuthAction();

  try {
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: authUser.workspaceId },
    });
    if (!vps) return { error: "Server not found" };

    // Clean up PEM from S3 if exists
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
  } catch {
    return { error: "Failed to delete server" };
  }
}

/**
 * Execute SSH command (start/stop/reboot).
 */
async function executeSSHCommand(serverId: string, command: string, actionName: string) {
  const authUser = await requireAuthAction();

  try {
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: authUser.workspaceId },
    });
    if (!vps) return { error: "Server not found" };

    const creds = await getSSHCreds(vps);

    const { NodeSSH } = await import("node-ssh");
    const ssh = new NodeSSH();
    await ssh.connect(creds as Parameters<typeof ssh.connect>[0]);
    await ssh.execCommand(command);
    ssh.dispose();

    const statusMap: Record<string, string> = { start: "online", stop: "offline", reboot: "online" };
    await db.vps.update({ where: { id: serverId }, data: { status: statusMap[actionName] ?? "online", lastSeenAt: new Date() } });

    await logActivity({ action: `vps.${actionName}`, userId: authUser.id, workspaceId: authUser.workspaceId, target: vps.displayName });

    revalidatePath("/dashboard");
    revalidatePath("/servers");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) {
      await db.vps.update({ where: { id: serverId }, data: { status: "offline" } }).catch(() => {});
    }
    return { error: msg.includes("ECONNREFUSED") ? "Server unreachable" : msg.includes("ETIMEDOUT") ? "Connection timed out" : `Failed to ${actionName}` };
  }
}

export async function startServer(serverId: string) { return executeSSHCommand(serverId, "sudo systemctl start --all 2>/dev/null || echo started", "start"); }
export async function stopServer(serverId: string) { return executeSSHCommand(serverId, "sudo systemctl poweroff", "stop"); }
export async function rebootServer(serverId: string) { return executeSSHCommand(serverId, "sudo reboot", "reboot"); }
