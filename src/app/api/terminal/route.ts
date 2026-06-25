import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPresignedUrl } from "@/lib/s3";
import { NodeSSH } from "node-ssh";

export const dynamic = "force-dynamic";

/**
 * POST /api/terminal
 * Executes a command on a server via SSH and returns the output.
 * This is a synchronous HTTP-based approach (not WebSocket) that works
 * within Next.js API routes. Each request opens an SSH connection,
 * executes the command, and returns the result.
 *
 * For a persistent WebSocket terminal, deploy a separate Node.js
 * process with node-pty + SSH.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("nimbus_session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session
    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { user: { include: { teamMembers: true } } },
    });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Check permission (Owner, Admin, SSH_USER can use console)
    const membership = session.user.teamMembers[0];
    if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 403 });
    const allowedRoles = ["OWNER", "ADMIN", "SSH_USER"];
    if (!allowedRoles.includes(membership.role)) {
      return NextResponse.json({ error: "Console access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { serverId, command } = body;

    if (!serverId || !command) {
      return NextResponse.json({ error: "serverId and command required" }, { status: 400 });
    }

    // Get server
    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: membership.workspaceId },
    });
    if (!vps) return NextResponse.json({ error: "Server not found" }, { status: 404 });
    if (vps.status !== "online") return NextResponse.json({ error: "Server is offline" }, { status: 400 });

    // Get PEM
    const pemUrl = await getPresignedUrl(vps.pemKeyS3Key, 60);
    const pemResp = await fetch(pemUrl);
    if (!pemResp.ok) return NextResponse.json({ error: "Cannot retrieve SSH key" }, { status: 500 });
    const privateKey = await pemResp.text();

    // SSH connect and execute
    const ssh = new NodeSSH();
    await ssh.connect({
      host: vps.publicIp,
      port: vps.sshPort,
      username: vps.username,
      privateKey,
      readyTimeout: 10000,
    });

    const result = await ssh.execCommand(command, { cwd: "/home/" + vps.username });
    ssh.dispose();

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code,
    });
  } catch (error) {
    console.error("[Terminal API]", error);
    const msg = error instanceof Error ? error.message : "Command execution failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
