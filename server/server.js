/**
 * NimbusPanel WebSocket/SSH Backend
 *
 * Independent Node.js service that hosts the browser SSH terminal.
 * Deploys separately from the Next.js frontend (e.g. on Render).
 *
 * Responsibilities:
 *   - Load environment
 *   - Create HTTP server (health endpoint)
 *   - Attach WebSocket server (/ws/terminal)
 *   - Start listening
 */

require("dotenv").config();

const { createServer } = require("http");
const { createRouter } = require("./routes/health");
const { attachWebSocket } = require("./websocket");
const { logger } = require("./utils/logger");

const PORT = parseInt(process.env.PORT || "8080", 10);

// HTTP server (health + 404)
let connectionsRef = { size: 0 };
const router = createRouter(() => connectionsRef.size);
const httpServer = createServer(router);

// WebSocket terminal server
const { connections } = attachWebSocket(httpServer);
connectionsRef = connections;

httpServer.listen(PORT, () => {
  logger.info("NimbusPanel WebSocket/SSH backend started");
  logger.info(`Port:            ${PORT}`);
  logger.info(`Health:          http://0.0.0.0:${PORT}/health`);
  logger.info(`Terminal WS:     /ws/terminal`);
  logger.info(`Allowed origin:  ${process.env.ALLOWED_ORIGIN || "https://nimbuspanel.vercel.app"}`);
  logger.info(`Environment:     ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  httpServer.close(() => process.exit(0));
});
