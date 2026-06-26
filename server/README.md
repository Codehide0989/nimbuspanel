# NimbusPanel — WebSocket/SSH Backend

Independent Node.js service that powers the browser-based SSH terminal for NimbusPanel. It runs separately from the Next.js frontend (which is hosted on Vercel) because Vercel's serverless functions cannot maintain persistent WebSocket connections.

## Architecture

```
Browser (NimbusPanel /console)
        │  wss://  (NEXT_PUBLIC_WS_URL)
        ▼
This backend (Render)
        │  ssh2 / node-ssh
        ▼
Target VPS (interactive PTY shell)
```

The backend shares the same PostgreSQL database and `APP_SECRET` as the frontend so it can:
- Validate session tokens
- Enforce role + workspace access
- Decrypt stored SSH credentials (AES-256-GCM)
- Fetch PEM keys from S3

## Project Structure

```
server/
  server.js              # Entry: load env, HTTP server, WS server, listen
  prisma/schema.prisma   # Prisma schema (shared models)
  lib/
    prisma.js            # Prisma client singleton
    crypto.js            # AES-256-GCM decrypt
    s3.js                # Presigned URL for PEM keys
  middleware/
    cors.js              # Origin allowlist
  routes/
    health.js            # GET /health router
  websocket/
    index.js             # WebSocket upgrade handling
  ssh/
    connection.js        # SSH connect + PTY shell
  terminal/
    handler.js           # Terminal session lifecycle
  utils/
    logger.js            # Structured logging
```

## Installation

```bash
cd server
npm install
```

`prisma generate` runs automatically via the `postinstall` script.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `PORT` | Port to listen on (Render provides this automatically) |
| `APP_SECRET` | Must match the frontend — decrypts stored credentials |
| `DATABASE_URL` | Same PostgreSQL database as the frontend |
| `AWS_REGION` | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_S3_BUCKET_NAME` | Bucket holding PEM keys |
| `ALLOWED_ORIGIN` | Frontend origin allowed to connect |

## Local Development

```bash
cd server
cp .env.example .env   # fill in values
npm install
npm run dev            # node server.js
```

The backend listens on `http://localhost:8080` by default. Set the frontend's `NEXT_PUBLIC_WS_URL` to `ws://localhost:8080/ws/terminal`.

## Render Deployment

1. Create a new **Web Service** on Render
2. Root directory: `server`
3. **Build Command:** `npm install`
4. **Start Command:** `node server.js`
5. Add environment variables from the table above
6. Render assigns `PORT` automatically

After deploy, set the frontend's `NEXT_PUBLIC_WS_URL` to:

```
wss://<your-render-service>.onrender.com/ws/terminal
```

## Endpoints

### WebSocket — `/ws/terminal`

Query params: `?serverId=<vpsId>&token=<sessionToken>`

Message protocol (JSON):
- Client → Server: `{ type: "input", data }`, `{ type: "resize", cols, rows }`, `{ type: "ping" }`
- Server → Client: `{ type: "connected" }`, `{ type: "output", data }`, `{ type: "error", message }`, `{ type: "disconnected", reason }`, `{ type: "pong" }`

Features: heartbeat (30s), origin validation, session auth, automatic cleanup.

### HTTP — `GET /health`

```json
{ "status": "ok", "uptime": 1234, "connections": 2, "timestamp": "..." }
```

## Security

- Only configured origins may open WebSocket connections
- Session token validated against the database on every connection
- Role check: only `OWNER`, `ADMIN`, `SSH_USER` may open terminals
- VPS access scoped to the user's workspace
- Credentials decrypted server-side only, never sent to the browser
