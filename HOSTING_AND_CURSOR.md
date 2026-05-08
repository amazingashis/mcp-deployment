# Hosting this server for free and using it from Cursor (remote only)

Your skills live in the **`skills/`** folder next to the server (or whatever you set **`SKILLS_ROOT`** to). All packs from **`.cursor/skills`** have been copied into **`skills-mcp-server/skills/`** so the MCP server can list them.

**Important:** Cursor does not mirror the local “Skills” sidebar from `.cursor/skills` for a remote MCP server. After you connect this server, skills show up as **MCP resources** (`skills://skill/...`) and **tools** (`list_skills`, `get_skill`, `search_skills`) and **prompts** (`skill_context`). Use the agent’s MCP tools / resource picker, or call `list_skills` in chat.

This server exposes two transports on the same HTTPS host:

| Transport | Cursor / clients | URL to configure |
|-----------|------------------|------------------|
| **Legacy HTTP + SSE** (deprecated in MCP spec, still widely used) | Most “remote URL” MCP setups | `https://YOUR_HOST/sse` |
| **Streamable HTTP** (MCP 2025-03-26+) | Newer clients that support it | `https://YOUR_HOST/mcp` |

If one URL fails in Cursor, try the other. Both honor **`MCP_AUTH_TOKEN`** when set (see below).

---

## 1. Prepare the repo

1. Commit **`skills-mcp-server/`** including the **`skills/`** directory (your transferred skills).
2. Generate a long random token (example PowerShell):  
   `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')`  
   You will set this as **`MCP_AUTH_TOKEN`** on the host.

---

## 2. Free / cheap hosting options

“Free” tiers change often; verify current pricing and limits on each site. None of these should be used for **PHI** or regulated data.

### A) [Render](https://render.com) (Web Service + Dockerfile)

1. Create account, **New +** → **Web Service**, connect your Git repo.
2. Set **Root Directory** to `skills-mcp-server` (if the repo is the parent folder).
3. **Dockerfile path**: `Dockerfile` (default if root is `skills-mcp-server`).
4. **Environment** (minimum):

   | Variable | Value |
   |----------|--------|
   | `MCP_TRANSPORT` | `http` |
   | `HOST` | `0.0.0.0` |
   | `PORT` | `8787` (must match Dockerfile `EXPOSE` / Render’s internal port) |
   | `MCP_ALLOWED_HOSTS` | Your Render hostname, e.g. `skills-mcp-server.onrender.com` |
   | `MCP_AUTH_TOKEN` | Your long random secret |
   | `SKILLS_ROOT` | `/app/skills` (matches Dockerfile) |

5. Render provides **HTTPS** automatically. Your MCP base is `https://<service-name>.onrender.com`.
6. **Health check path**: `/health` (optional but recommended).

**Caveats:** Free web services **spin down** after idle time; first request can be slow. Cold starts are normal.

### B) [Railway](https://railway.app)

1. New project → **Deploy from GitHub** → select repo, set root to `skills-mcp-server`.
2. Railway detects Dockerfile or you set start command: `node dist/main.js` after build.
3. Set the same env vars as above; map **public domain** and set **`MCP_ALLOWED_HOSTS`** to that hostname.
4. Railway gives HTTPS on the generated domain.

### C) [Fly.io](https://fly.io)

1. Install `flyctl`, run `fly launch` inside `skills-mcp-server` (follow prompts).
2. Set secrets: `fly secrets set MCP_AUTH_TOKEN=... MCP_ALLOWED_HOSTS=...` etc.
3. Ensure **`internal_port`** matches **`PORT`** (8787).

### D) [Koyeb](https://www.koyeb.com)

1. Create **App** from GitHub, type **Docker**, root `skills-mcp-server`.
2. Set env vars; Koyeb assigns an `*.koyeb.app` HTTPS URL → use that in **`MCP_ALLOWED_HOSTS`**.

### E) [Google Cloud Run](https://cloud.google.com/run) (free tier / credits)

Containerize the same Dockerfile; set env vars in the service; use the `run.app` HTTPS URL in **`MCP_ALLOWED_HOSTS`**.

---

## 3. Required environment variables (remote)

| Variable | Why |
|----------|-----|
| `MCP_TRANSPORT=http` | Enables HTTP mode in this package. |
| `HOST=0.0.0.0` | Listen on all interfaces (required in containers). |
| `PORT` | Must match what the platform exposes (8787 in Dockerfile). |
| **`MCP_ALLOWED_HOSTS`** | Comma-separated **public** hostnames from the `Host` header. **Required** when `HOST=0.0.0.0` so the SDK’s host validation passes. Example: `myapp.onrender.com`. |
| **`MCP_AUTH_TOKEN`** | Strongly recommended: Bearer token for **`/mcp`**, **`/sse`**, **`/messages`**. |
| `SKILLS_ROOT` | Path to the skills tree inside the container (`/app/skills` in the provided Dockerfile). |

Do **not** commit real tokens. Set them only in the host’s secret / env UI.

---

## 4. Connect from Cursor (remote, not local)

1. Open **Cursor Settings → MCP** (or edit config file — see [Cursor MCP docs](https://cursor.com/docs/context/mcp)).
2. Add a server with a **`url`** (not `command`).

### Option A — SSE (try this first in Cursor)

```json
{
  "mcpServers": {
    "skills-remote": {
      "url": "https://YOUR_HOST/sse",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

### Option B — Streamable HTTP

```json
{
  "mcpServers": {
    "skills-remote": {
      "url": "https://YOUR_HOST/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

You can put this in **project** `.cursor/mcp.json` (team-shared) or **user** MCP config, depending on how Cursor is configured on your machine.

3. **Reload / restart Cursor** so MCP picks up the change.
4. Confirm the server is green in MCP settings; open the server’s tool list — you should see **`list_skills`**, **`get_skill`**, **`search_skills`**.

### If auth fails on SSE

Some clients open the SSE stream without forwarding custom headers. If you get **401** on **`/sse`** but POST works elsewhere, check Cursor’s MCP docs for your version, or temporarily test **without** `MCP_AUTH_TOKEN` on a private URL only (not recommended long-term).

### TLS

Always use **`https://`** in the URL. Do not point production MCP at plain `http://` over the public internet.

### `Invalid Host: your.onrender.com` in the browser

That JSON is **not** a normal web page; it means the **`Host`** header did not match **`MCP_ALLOWED_HOSTS`**.

Fix on Render:

1. Set **`MCP_ALLOWED_HOSTS`** to the hostname **only** (no `https://`, no path), e.g. `mcp-deployment-fzca.onrender.com`.
2. It must match your live URL **exactly** (no typo vs `onrender.com`).
3. If you pasted a full URL, redeploy after upgrading the server: newer builds accept `https://host/` in **`MCP_ALLOWED_HOSTS`** and normalize it to the hostname.

Opening **`https://…/sse`** or **`/mcp`** in a browser often hits MCP with a **`Host`** that still must be on the allowlist; **`/health`** is not subject to that check.

---

## 5. Sanity checks from your laptop

Replace host and token:

```bash
curl -sS "https://YOUR_HOST/health"
curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer YOUR_TOKEN" "https://YOUR_HOST/sse"
```

You should get **`200`** on `/health`. **`/sse`** may hang while streaming (that is expected for `curl`); in Cursor, the same URL should establish the MCP session.

---

## 6. Updating skills later

1. Edit or add folders under **`skills-mcp-server/skills/<name>/SKILL.md`**.
2. Commit and redeploy (or rebuild the Docker image).  
   No code change is required unless you change **`SKILLS_ROOT`**.

---

## Summary

| Goal | Action |
|------|--------|
| Skills in the “bucket” | Use **`skills-mcp-server/skills/`** (already populated from `.cursor/skills`). |
| See them in Cursor | Connect remote MCP; use **`list_skills`** / resources, not the local-only Skills UI. |
| Free HTTPS host | Render / Railway / Fly / Koyeb / Cloud Run — Dockerfile in **`skills-mcp-server`**. |
| Cursor URL | Prefer **`https://HOST/sse`**; fallback **`https://HOST/mcp`**. |
| Security | **`MCP_AUTH_TOKEN`** + **`MCP_ALLOWED_HOSTS`** + HTTPS only. |
