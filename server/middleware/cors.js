/**
 * Origin allowlist for WebSocket upgrades and HTTP responses.
 * Only the configured frontend origin and localhost are permitted.
 */
function getAllowedOrigins() {
  return [
    process.env.ALLOWED_ORIGIN,
    "https://nimbuspanel.vercel.app",
    "http://localhost:3000",
  ].filter(Boolean);
}

function isOriginAllowed(origin) {
  if (!origin) return true; // non-browser clients (no Origin header)
  return getAllowedOrigins().includes(origin);
}

function applyCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

module.exports = { isOriginAllowed, applyCorsHeaders, getAllowedOrigins };
