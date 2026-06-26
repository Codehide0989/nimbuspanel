/**
 * Custom Next.js server with WebSocket support for SSH terminal.
 * 
 * Usage: node server.js
 * This replaces `next start` for production deployments that need
 * persistent WebSocket connections (SSH terminal).
 * 
 * For Vercel/serverless, the HTTP fallback in /api/terminal still works
 * but without true interactive support.
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const { NodeSSH } = require("node-ssh");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// ─── Crypto helpers ─────────────────────────────────────

function decrypt(ciphertext) {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET not set");
  const key = crypto.scryptSync(secret, "nimbuspanel-salt", 32);
  const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function getPresignedUrl(key) {
  const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
  const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: key });
  return getSignedUrl(client, command, { expiresIn: 120 });
}

// ─── WebSocket Terminal Handler ─────────────────────────

async function handleTerminalConnection(ws, req) {
  let ssh = null;
  let shell = null;
  let heartbeat = null;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const serverId = url.searchParams.get("serverId");
  const token = url.searchParams.get("token");

  if (!serverId || !token) {
    ws.send(JSON.stringify({ type: "error", message: "Missing serverId or token" }));
    ws.close();
    return;
  }

  // Authenticate
  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: { include: { teamMembers: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      ws.send(JSON.stringify({ type: "error", message: "Session expired" }));
      ws.close();
      return;
    }

    const membership = session.user.teamMembers[0];
    if (!membership || !["OWNER", "ADMIN", "SSH_USER"].includes(membership.role)) {
      ws.send(JSON.stringify({ type: "error", message: "Console access denied" }));
      ws.close();
      return;
    }

    // Get server
    const vps = await prisma.vps.findFirst({
      where: { id: serverId, workspaceId: membership.workspaceId },
    });

    if (!vps) {
      ws.send(JSON.stringify({ type: "error", message: "Server not found" }));
      ws.close();
      return;
    }

    // Build SSH credentials
    const connectOpts = {
      host: vps.publicIp,
      port: vps.sshPort,
      username: vps.username,
      readyTimeout: 15000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
    };

    if (vps.authMethod === "password" && vps.passwordEnc) {
      connectOpts.password = decrypt(vps.passwordEnc);
    } else if (vps.pemKeyS3Key) {
      const pemUrl = await getPresignedUrl(vps.pemKeyS3Key);
      const resp = await fetch(pemUrl);
      if (!resp.ok) throw new Error("Cannot retrieve SSH key");
      connectOpts.privateKey = await resp.text();
      if (vps.keyPassphrase) connectOpts.passphrase = decrypt(vps.keyPassphrase);
    } else {
      ws.send(JSON.stringify({ type: "error", message: "No credentials configured" }));
      ws.close();
      return;
    }

    // Connect SSH
    console.log(`[Terminal] Connecting to ${vps.publicIp}:${vps.sshPort} as ${vps.username}`);
    ssh = new NodeSSH();
    await ssh.connect(connectOpts);
    console.log("[Terminal] SSH connected");

    // Create interactive shell with PTY
    const connection = ssh.connection;
    shell = await new Promise((resolve, reject) => {
      connection.shell(
        { term: "xterm-256color", cols: 120, rows: 30 },
        (err, stream) => {
          if (err) reject(err);
          else resolve(stream);
        }
      );
    });
    console.log("[Terminal] PTY created, shell started");

    ws.send(JSON.stringify({ type: "connected", server: vps.displayName }));

    // ─── Stream: PTY → WebSocket ────────────────────
    shell.on("data", (data) => {
      if (ws.readyState === 1) { // WebSocket OPEN
        ws.send(JSON.stringify({ type: "output", data: data.toString("utf-8") }));
      }
    });

    shell.stderr.on("data", (data) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "output", data: data.toString("utf-8") }));
      }
    });

    shell.on("close", () => {
      console.log("[Terminal] Shell closed");
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: "disconnected", reason: "Shell exited" }));
        ws.close();
      }
    });

    // ─── Stream: WebSocket → PTY ────────────────────
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "input" && msg.data && shell.writable) {
          shell.write(msg.data);
        } else if (msg.type === "resize" && msg.cols && msg.rows) {
          shell.setWindow(msg.rows, msg.cols, 0, 0);
        } else if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Raw string input (legacy)
        if (shell && shell.writable) shell.write(raw.toString());
      }
    });

    // ─── Heartbeat ──────────────────────────────────
    heartbeat = setInterval(() => {
      if (ws.readyState === 1) ws.ping();
    }, 30000);

    ws.on("pong", () => { /* client alive */ });

  } catch (error) {
    const msg = error.message || "Connection failed";
    console.error("[Terminal] Error:", msg);

    let userMessage = msg;
    if (msg.includes("ECONNREFUSED")) userMessage = "Connection refused — server offline";
    else if (msg.includes("ETIMEDOUT")) userMessage = "Connection timed out";
    else if (msg.includes("auth")) userMessage = "Authentication failed";

    ws.send(JSON.stringify({ type: "error", message: userMessage }));
    ws.close();
  }

  // ─── Cleanup ──────────────────────────────────────
  ws.on("close", () => {
    console.log("[Terminal] WebSocket closed");
    if (heartbeat) clearInterval(heartbeat);
    if (shell) { try { shell.end(); } catch {} }
    if (ssh) { try { ssh.dispose(); } catch {} }
  });

  ws.on("error", (err) => {
    console.error("[Terminal] WebSocket error:", err.message);
    if (heartbeat) clearInterval(heartbeat);
    if (shell) { try { shell.end(); } catch {} }
    if (ssh) { try { ssh.dispose(); } catch {} }
  });
}

// ─── Server Setup ───────────────────────────────────────

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server for terminal
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true);

    if (pathname === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleTerminalConnection(ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", () => {
    console.log("[Terminal] New WebSocket connection");
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`> NimbusPanel ready on http://localhost:${port}`);
    console.log(`> WebSocket terminal: ws://localhost:${port}/ws/terminal`);
  });
});
