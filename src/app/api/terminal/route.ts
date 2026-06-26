import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPresignedUrl } from "@/lib/s3";
import { decrypt } from "@/lib/crypto";
import { NodeSSH } from "node-ssh";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("nimbus_session")?.value;
    if (!sessionToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = await db.session.findUnique({
      where: { token: sessionToken },
      include: { user: { include: { teamMembers: true } } },
    });
    if (!session || session.expiresAt < new Date()) return NextResponse.json({ error: "Session expired" }, { status: 401 });

    const membership = session.user.teamMembers[0];
    if (!membership) return NextResponse.json({ error: "No workspace" }, { status: 403 });

    const allowedRoles = ["OWNER", "ADMIN", "SSH_USER"];
    if (!allowedRoles.includes(membership.role)) return NextResponse.json({ error: "Console access denied" }, { status: 403 });

    const body = await request.json();
    const { serverId, command } = body;
    if (!serverId || typeof command !== "string") return NextResponse.json({ error: "serverId and command required" }, { status: 400 });
    if (command.length > 4096) return NextResponse.json({ error: "Command too long" }, { status: 400 });

    const vps = await db.vps.findFirst({
      where: { id: serverId, workspaceId: membership.workspaceId },
    });
    if (!vps) return NextResponse.json({ error: "Server not found" }, { status: 404 });
    if (vps.status !== "online") return NextResponse.json({ error: "Server is offline" }, { status: 400 });

    // Build SSH connection options based on auth method
    const connectOpts: Record<string, unknown> = {
      host: vps.publicIp,
      port: vps.sshPort,
      username: vps.username,
      readyTimeout: 15000,
    };

    if (vps.authMethod === "password" && vps.passwordEnc) {
      connectOpts.password = decrypt(vps.passwordEnc);
    } else if (vps.pemKeyS3Key) {
      const pemUrl = await getPresignedUrl(vps.pemKeyS3Key, 60);
      const pemResp = await fetch(pemUrl);
      if (!pemResp.ok) return NextResponse.json({ error: "Cannot retrieve SSH key" }, { status: 500 });
      connectOpts.privateKey = await pemResp.text();
      if (vps.keyPassphrase) connectOpts.passphrase = decrypt(vps.keyPassphrase);
    } else {
      return NextResponse.json({ error: "No authentication credentials configured" }, { status: 500 });
    }

    const ssh = new NodeSSH();
    await ssh.connect(connectOpts as Parameters<typeof ssh.connect>[0]);
    const result = await ssh.execCommand(command, { cwd: `/home/${vps.username}`, execOptions: { pty: true } });
    ssh.dispose();

    return NextResponse.json({ stdout: result.stdout || "", stderr: result.stderr || "", code: result.code ?? 0 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Command failed";
    if (msg.includes("ECONNREFUSED")) return NextResponse.json({ error: "Connection refused" }, { status: 502 });
    if (msg.includes("ETIMEDOUT")) return NextResponse.json({ error: "Connection timed out" }, { status: 504 });
    if (msg.includes("auth")) return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
