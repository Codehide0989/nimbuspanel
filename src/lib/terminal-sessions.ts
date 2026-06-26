/**
 * Server-side SSH session manager.
 * Maintains persistent interactive shell sessions per user+server combination.
 * Sessions are kept alive for the duration of use and cleaned up on disconnect.
 */

import { NodeSSH } from "node-ssh";
import { getPresignedUrl } from "./s3";
import { decrypt } from "./crypto";
import type { ClientChannel } from "ssh2";

interface TerminalSession {
  ssh: NodeSSH;
  shell: ClientChannel;
  output: string[];
  lastActivity: number;
  connected: boolean;
}

// In-memory session store (per-process). For multi-instance deployment, use Redis.
const sessions = new Map<string, TerminalSession>();

// Cleanup idle sessions every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const keys = Array.from(sessions.keys());
    for (const key of keys) {
      const session = sessions.get(key);
      if (session && now - session.lastActivity > 30 * 60 * 1000) {
        // 30 min idle timeout
        destroySession(key);
      }
    }
  }, 60 * 1000);
}

function sessionKey(userId: string, serverId: string): string {
  return `${userId}:${serverId}`;
}

export async function getOrCreateSession(
  userId: string,
  serverId: string,
  connectOpts: {
    host: string;
    port: number;
    username: string;
    authMethod: string;
    passwordEnc: string | null;
    pemKeyS3Key: string | null;
    keyPassphrase: string | null;
  }
): Promise<{ session: TerminalSession; isNew: boolean } | { error: string }> {
  const key = sessionKey(userId, serverId);

  // Return existing if alive
  const existing = sessions.get(key);
  if (existing && existing.connected) {
    existing.lastActivity = Date.now();
    return { session: existing, isNew: false };
  }

  // Clean up stale session
  if (existing) destroySession(key);

  // Build credentials
  const sshOpts: Record<string, unknown> = {
    host: connectOpts.host,
    port: connectOpts.port,
    username: connectOpts.username,
    readyTimeout: 15000,
    keepaliveInterval: 10000,
  };

  try {
    if (connectOpts.authMethod === "password" && connectOpts.passwordEnc) {
      sshOpts.password = decrypt(connectOpts.passwordEnc);
    } else if (connectOpts.pemKeyS3Key) {
      const pemUrl = await getPresignedUrl(connectOpts.pemKeyS3Key, 120);
      const resp = await fetch(pemUrl);
      if (!resp.ok) return { error: "Cannot retrieve SSH key from storage" };
      sshOpts.privateKey = await resp.text();
      if (connectOpts.keyPassphrase) sshOpts.passphrase = decrypt(connectOpts.keyPassphrase);
    } else {
      return { error: "No authentication credentials configured for this server" };
    }

    const ssh = new NodeSSH();
    await ssh.connect(sshOpts as Parameters<typeof ssh.connect>[0]);

    // Request interactive shell with PTY
    const connection = ssh.connection;
    if (!connection) return { error: "SSH connection not established" };

    const shell = await new Promise<ClientChannel>((resolve, reject) => {
      connection.shell(
        {
          term: "xterm-256color",
          cols: 120,
          rows: 30,
          modes: {},
        },
        (err: Error | undefined, stream: ClientChannel) => {
          if (err) reject(err);
          else resolve(stream);
        }
      );
    });

    const newSession: TerminalSession = {
      ssh,
      shell,
      output: [],
      lastActivity: Date.now(),
      connected: true,
    };

    // Capture output
    shell.on("data", (data: Buffer) => {
      newSession.output.push(data.toString("utf-8"));
      newSession.lastActivity = Date.now();
      // Keep only last 1000 chunks to prevent memory leak
      if (newSession.output.length > 1000) {
        newSession.output = newSession.output.slice(-500);
      }
    });

    shell.stderr.on("data", (data: Buffer) => {
      newSession.output.push(data.toString("utf-8"));
    });

    shell.on("close", () => {
      newSession.connected = false;
    });

    shell.on("end", () => {
      newSession.connected = false;
    });

    sessions.set(key, newSession);
    return { session: newSession, isNew: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Connection failed";
    if (msg.includes("ECONNREFUSED")) return { error: "Connection refused — server may be offline" };
    if (msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND")) return { error: "Host unreachable — check IP/domain" };
    if (msg.includes("All configured authentication methods failed")) return { error: "Authentication failed — wrong password or invalid key" };
    if (msg.includes("auth")) return { error: "Authentication failed" };
    if (msg.includes("passphrase")) return { error: "Private key requires a passphrase" };
    return { error: msg };
  }
}

export function writeToSession(userId: string, serverId: string, data: string): boolean {
  const key = sessionKey(userId, serverId);
  const session = sessions.get(key);
  if (!session || !session.connected) return false;

  session.shell.write(data);
  session.lastActivity = Date.now();
  return true;
}

export function readFromSession(userId: string, serverId: string): string {
  const key = sessionKey(userId, serverId);
  const session = sessions.get(key);
  if (!session) return "";

  const output = session.output.join("");
  session.output = [];
  return output;
}

export function resizeSession(userId: string, serverId: string, cols: number, rows: number): boolean {
  const key = sessionKey(userId, serverId);
  const session = sessions.get(key);
  if (!session || !session.connected) return false;

  session.shell.setWindow(rows, cols, 0, 0);
  return true;
}

export function isSessionAlive(userId: string, serverId: string): boolean {
  const key = sessionKey(userId, serverId);
  const session = sessions.get(key);
  return !!session && session.connected;
}

export function destroySession(key: string): void;
export function destroySession(userId: string, serverId: string): void;
export function destroySession(userIdOrKey: string, serverId?: string): void {
  const key = serverId ? sessionKey(userIdOrKey, serverId) : userIdOrKey;
  const session = sessions.get(key);
  if (session) {
    try { session.shell.end(); } catch { /* ignore */ }
    try { session.ssh.dispose(); } catch { /* ignore */ }
    session.connected = false;
    sessions.delete(key);
  }
}
