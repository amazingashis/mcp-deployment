# Deployment notes

## Container image

Build:

```bash
docker build -t skills-mcp-server:latest .
```

Run (set a strong random token and allowed hosts):

```bash
docker run --rm -p 8787:8787 \
  -e MCP_TRANSPORT=http \
  -e HOST=0.0.0.0 \
  -e MCP_ALLOWED_HOSTS=mcp.example.com,localhost \
  -e MCP_AUTH_TOKEN="$TOKEN" \
  -e SKILLS_ROOT=/app/skills \
  -e MCP_USAGE_TRACKING=true \
  -e MCP_USAGE_WEB=true \
  -e MCP_USAGE_LOG=/tmp/skills-mcp-usage.ndjson \
  -e MCP_USAGE_HASH_SALT="$USAGE_SALT" \
  -e MCP_USAGE_WEB_USER=cursor \
  -e MCP_USAGE_WEB_PASSWORD=cursor \
  -v /path/on/host/skills:/app/skills:ro \
  skills-mcp-server:latest
```

Omit **`MCP_USAGE_*`** lines if you do not want the NDJSON audit log or **`/usage`** dashboard — they are optional.

`docker-compose.yml` can mirror the same variables.

## Reverse proxy (recommended)

- Terminate TLS on nginx, Caddy, or a cloud load balancer.
- Proxy **`/`** to the Node listener (or at least `/mcp`, `/sse`, `/messages`, `/health`, and **`/usage`** if **`MCP_USAGE_WEB=true`**).
- Enforce **HTTPS** and redirect HTTP → HTTPS at the edge.
- Forward **`Host`** unchanged so `MCP_ALLOWED_HOSTS` matches.

Example nginx location (illustrative):

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_buffering off;
}

location /sse {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_buffering off;
}

location /messages {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}

# Usage dashboard (Basic Auth handled by Node; omit if MCP_USAGE_WEB is disabled)
location ^~ /usage {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Security checklist

- **TLS** in front of the service; do not expose plain HTTP for MCP on untrusted networks.
- **`MCP_AUTH_TOKEN`** in production; rotate via secrets manager.
- **`MCP_ALLOWED_HOSTS`** whenever `HOST=0.0.0.0`.
- Mount skills **`SKILLS_ROOT` read-only** in containers.
- Treat skill Markdown as **trusted content** only from trusted writers (server returns file contents to models).

## Observability

- Logs go to stderr; avoid capturing full skill bodies at `info` level in shared log sinks if policies require minimal retention.
- Use **`GET /health`** for Kubernetes `/livez`/`/readyz` (unauthenticated by design).
- **Usage dashboard (hosted):** set **`MCP_USAGE_WEB=true`**, **`MCP_USAGE_TRACKING=true`**, and **`MCP_USAGE_LOG`**, then browse **`https://<public-host>/usage`** per **`HOSTING_AND_CURSOR.md`**; route **`/usage`** through your ingress.

## Protocol compliance

- **Streamable HTTP:** `StreamableHTTPServerTransport` in **stateless** mode on **`POST /mcp`**.
- **Legacy SSE:** **`GET /sse`** and **`POST /messages`** for older / Cursor-style remote clients.
- **stdio** uses `StdioServerTransport` for local IDE workflows.
