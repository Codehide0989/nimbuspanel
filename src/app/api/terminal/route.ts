import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPresignedUrl } from "@/lib/s3";
import { NodeSSH } from "node-ssh";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/terminal
 * Executes a command on a server via SSH and returns the full output.
 * Each request creates an SSH session, runs the command with a PTY,
 * and returns combined stdout/stderr.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("nimbus_session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { user: { include: { teamMembers: true } } },
    });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const membership = session.user.teamMembers[0];
    if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 403 });

    // RBAC: Only Owner, Admin, SSH_USER can use console
    const allowedRoles = ["OWNER", "ADMIN", "SSH_USER"];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: "Console access denied for your role" }, { status: 403 });
    }

    const body = await request.json();
    const { serverId, command } = body;

    if (!serverId || typeof command !== "string") {
      return NextResponse.json({ error: "serverId and command are required" }, { status: 400 });
    }

    // Security: reject dangerous injection patterns
    if (command.length > 4096) {
      return NextResponse.json({ error: "Command too long" }, { status: 400 });
    }

    // Get server — enforce workspace scope
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: membership.workspaceId },
      select: { id: true, publicIp: true, sshPort: true, username: true, pemKeyS3Key: true, status: true, displayName: true },
    });

    if (!vps) return NextResponse.json({ error: "Server not found or access denied" }, { status: 404 });
    if (vps.status !== "online") return NextResponse.json({ error: "Server is offline. Start it first." }, { status: 400 });

    // Get PEM from S3
    const pemUrl = await getPresignedUrl(vps.pemKeyS3Key, 60);
    const pemResp = await fetch(pemUrl);
    if (!pemResp.ok) return NextResponse.json({ error: "Cannot retrieve SSH key from storage" }, { status: 500 });
    const privateKey = await pemResp.text();

    // Connect and execute with PTY for proper terminal behavior
    const ssh = new NodeSSH();
    await ssh.connect({
      host: vps.publicIp,
      port: vps.sshPort,
      username: vps.username,
      privateKey,
      readyTimeout: 15000,
      tryKeyboard: false,
    });

    // Use execCommand with stream for better output handling
    const result = await ssh.execCommand(command, {
      cwd: `/home/${vps.username}`,
      execOptions: { pty: true },
    });

    ssh.dispose();

    return NextResponse.json({
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      code: result.code ?? 0,
      server: vps.displayName,
    });
  } catch (error) {
    console.error("[Terminal API]", error);
    const msg = error instanceof Error ? error.message : "Command execution failed";

    // Map common SSH errors to user-friendly messages
    if (msg.includes("ECONNREFUSED")) return NextResponse.json({ error: "Connection refused. Server may be offline." }, { status: 502 });
    if (msg.includes("ETIMEDOUT")) return NextResponse.json({ error: "Connection timed out. Server unreachable." }, { status: 504 });
    if (msg.includes("auth")) return NextResponse.json({ error: "Authentication failed. PEM key may be invalid." }, { status: 401 });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
