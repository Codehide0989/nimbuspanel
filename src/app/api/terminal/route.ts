import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getOrCreateSession,
  writeToSession,
  readFromSession,
  resizeSession,
  destroySession,
  isSessionAlive,
} from "@/lib/terminal-sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authenticateRequest(request: NextRequest) {
  const sessionToken = request.cookies.get("nimbus_session")?.value;
  if (!sessionToken) return null;

  const session = await db.session.findUnique({
    where: { token: sessionToken },
    include: { user: { include: { teamMembers: true } } },
  });

  if (!session || session.expiresAt < new Date()) return null;
  const membership = session.user.teamMembers[0];
  if (!membership) return null;

  const allowedRoles = ["OWNER", "ADMIN", "SSH_USER"];
  if (!allowedRoles.includes(membership.role)) return null;

  return { userId: session.user.id, workspaceId: membership.workspaceId };
}

/**
 * POST /api/terminal
 * 
 * Actions:
 * - { action: "connect", serverId } — Create persistent shell session
 * - { action: "write", serverId, data } — Send input to shell (keystrokes)
 * - { action: "read", serverId } — Read buffered output
 * - { action: "resize", serverId, cols, rows } — Resize PTY
 * - { action: "disconnect", serverId } — Close session
 * - { action: "status", serverId } — Check if session alive
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action, serverId } = body;

    if (!action || !serverId) {
      return NextResponse.json({ error: "action and serverId required" }, { status: 400 });
    }

    // ─── Connect ────────────────────────────────────────
    if (action === "connect") {
      const vps = await db.vps.findFirst({
        where: { id: serverId, workspaceId: auth.workspaceId },
        select: {
          publicIp: true, sshPort: true, username: true,
          authMethod: true, passwordEnc: true, pemKeyS3Key: true, keyPassphrase: true,
          status: true, displayName: true,
        },
      });

      if (!vps) return NextResponse.json({ error: "Server not found" }, { status: 404 });
      if (vps.status !== "online") return NextResponse.json({ error: "Server is offline" }, { status: 400 });

      const result = await getOrCreateSession(auth.userId, serverId, {
        host: vps.publicIp,
        port: vps.sshPort,
        username: vps.username,
        authMethod: vps.authMethod,
        passwordEnc: vps.passwordEnc,
        pemKeyS3Key: vps.pemKeyS3Key,
        keyPassphrase: vps.keyPassphrase,
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 502 });
      }

      // Wait briefly for the shell prompt to appear
      await new Promise((r) => setTimeout(r, 500));
      const initialOutput = readFromSession(auth.userId, serverId);

      return NextResponse.json({
        connected: true,
        isNew: result.isNew,
        output: initialOutput,
        server: vps.displayName,
      });
    }

    // ─── Write (send keystrokes/input) ─────────────────
    if (action === "write") {
      const { data } = body;
      if (typeof data !== "string") return NextResponse.json({ error: "data required" }, { status: 400 });

      const written = writeToSession(auth.userId, serverId, data);
      if (!written) return NextResponse.json({ error: "Session not active" }, { status: 410 });

      return NextResponse.json({ ok: true });
    }

    // ─── Read (get buffered output) ────────────────────
    if (action === "read") {
      const output = readFromSession(auth.userId, serverId);
      const alive = isSessionAlive(auth.userId, serverId);

      return NextResponse.json({ output, alive });
    }

    // ─── Resize ────────────────────────────────────────
    if (action === "resize") {
      const { cols, rows } = body;
      if (!cols || !rows) return NextResponse.json({ error: "cols and rows required" }, { status: 400 });
      resizeSession(auth.userId, serverId, cols, rows);
      return NextResponse.json({ ok: true });
    }

    // ─── Disconnect ────────────────────────────────────
    if (action === "disconnect") {
      destroySession(auth.userId, serverId);
      return NextResponse.json({ disconnected: true });
    }

    // ─── Status ────────────────────────────────────────
    if (action === "status") {
      const alive = isSessionAlive(auth.userId, serverId);
      return NextResponse.json({ alive });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Terminal API]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
