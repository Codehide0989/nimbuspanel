const { WebSocketServer } = require("ws");
const { parse } = require("url");
const { isOriginAllowed } = require("../middleware/cors");
const { handleTerminalConnection } = require("../terminal/handler");
const { logger } = require("../utils/logger");

const TERMINAL_PATH = "/ws/terminal";

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Handles upgrade requests for /ws/terminal with origin validation.
 * Returns a registry Set tracking active connections (for /health).
 */
function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const connections = new Set();

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true);

    if (pathname !== TERMINAL_PATH) {
      socket.destroy();
      return;
    }

    const origin = req.headers.origin;
    if (!isOriginAllowed(origin)) {
      logger.warn(`Rejected WebSocket from origin: ${origin}`);
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      connections.add(ws);
      logger.info(`New terminal connection (active: ${connections.size})`);
      handleTerminalConnection(ws, req, connections);
    });
  });

  return { wss, connections };
}

module.exports = { attachWebSocket, TERMINAL_PATH };
