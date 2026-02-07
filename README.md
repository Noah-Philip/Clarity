# Clarity Workspace

Clarity now includes:

- A Node.js backend API for chat + RAG queries.
- A persistent local JSON database at `data/db.json`.
- Real-time message sync over Server-Sent Events (`/api/stream`).

## Run

```bash
npm start
```

By default, the server binds to `0.0.0.0:3000`, so other computers on the same network can connect.

## Multi-computer usage

1. Start Clarity on a reachable machine:
   ```bash
   HOST=0.0.0.0 PORT=3000 npm start
   ```
2. Open firewall/security group for your chosen port.
3. On each computer, open:
   - `http://<server-ip>:3000`

All messages are persisted in `data/db.json`, so chat history survives server restarts.

## Environment variables

- `HOST` (default: `0.0.0.0`)
- `PORT` (default: `3000`)
- `DATA_DIR` (default: `./data`)
- `DB_FILE` (default: `./data/db.json`)
