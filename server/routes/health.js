const { applyCorsHeaders } = require("../middleware/cors");

/**
 * Plain HTTP router for the backend.
 * Handles GET /health and returns 404 for everything else.
 */
function createRouter(getConnections) {
  return function handleRequest(req, res) {
    applyCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/health" || req.url === "/") {
      const body = JSON.stringify({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        connections: getConnections(),
        timestamp: new Date().toISOString(),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(body);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  };
}

module.exports = { createRouter };
