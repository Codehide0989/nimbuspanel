const { prisma } = require("../lib/prisma");
const { createShell } = require("../ssh/connection");
const { logger } = require("../utils/logger");

const ALLOWED_ROLES = ["OWNER", "ADMIN", "SSH_USER"];

/**
 * Authenticate a terminal WebSocket request via session token,
 * verify role + workspace, and return the target VPS record.
 */
async function authorize(token, serverId) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { teamMembers: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    return { error: "Session expired" };
  }

  const membership = session.user.teamMembers[0];
  if (!membership || !ALLOWED_ROLES.includes(membership.role)) {
    return { error: "Console access denied" };
  }

  const vps = await prisma.vps.findFirst({
    where: { id: serverId, workspaceId: membership.workspaceId },
  });

  if (!vps) return { error: "Server not found" };
  return { vps };
}

/**
 * Handle a single terminal WebSocket connection lifecycle:
 * authenticate → connect SSH → bridge PTY ↔ WebSocket → cleanup.
 */
async function handleTerminalConnection(ws, req, registry) {
  let ssh = null;
  let shell = null;
  let heartbeat = null;

  const cleanup = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (shell) { try { shell.end(); } catch {} }
    if (ssh) { try { ssh.dispose(); } catch {} }
    registry.delete(ws);
  };

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const serverId = url.searchParams.get("serverId");
    const token = url.searchParams.get("token");

    if (!serverId || !token) {
      ws.send(JSON.stringify({ type: "error", message: "Missing serverId or token" }));
      ws.close();
      return;
    }

    const auth = await authorize(token, serverId);
    if (auth.error) {
      ws.send(JSON.stringify({ type: "error", message: auth.error }));
      ws.close();
      return;
    }

    const { vps } = auth;
    logger.info(`Connecting to ${vps.publicIp}:${vps.sshPort} as ${vps.username}`);

    const conn = await createShell(vps);
    ssh = conn.ssh;
    shell = conn.shell;
    logger.info(`PTY ready for ${vps.displayName}`);

    ws.send(JSON.stringify({ type: "connected", server: vps.displayName }));

    // PTY → WebSocket
    shell.on("data", (data) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: "output", data: data.toString("utf-8") }));
    });
    shell.stderr.on("data", (data) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: "output", data: data.toString("utf-8") }));
    });
    shell.on("close", () => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "disconnected", reason: "Shell exited" }));
        ws.close();
      }
    });

    // WebSocket → PTY
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "input" && msg.data && shell.writable) shell.write(msg.data);
        else if (msg.type === "resize" && msg.cols && msg.rows) shell.setWindow(msg.rows, msg.cols, 0, 0);
        else if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
      } catch {
        if (shell && shell.writable) shell.write(raw.toString());
      }
    });

    // Heartbeat
    heartbeat = setInterval(() => {
      if (ws.readyState === 1) ws.ping();
    }, 30000);
  } catch (error) {
    const msg = (error && error.message) || "Connection failed";
    logger.error("Terminal error:", msg);

    let userMessage = msg;
    if (msg.includes("ECONNREFUSED")) userMessage = "Connection refused — server offline";
    else if (msg.includes("ETIMEDOUT")) userMessage = "Connection timed out";
    else if (msg.includes("auth")) userMessage = "Authentication failed";

    try { ws.send(JSON.stringify({ type: "error", message: userMessage })); } catch {}
    ws.close();
    cleanup();
    return;
  }

  ws.on("close", () => { logger.info("WebSocket closed"); cleanup(); });
  ws.on("error", (err) => { logger.error("WebSocket error:", err.message); cleanup(); });
}

module.exports = { handleTerminalConnection };
