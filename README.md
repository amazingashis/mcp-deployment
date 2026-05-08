# skills-mcp-server

A small [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes **Cursor-style skill packs** (`SKILL.md` trees) to any MCP client. It uses the official TypeScript SDK and supports:

- **stdio** — local subprocess mode (typical for Cursor / Claude Desktop spawning a command).
- **Streamable HTTP** — remote mode on **`POST /mcp`** (stateless), MCP **2025-03-26+**.
- **Legacy SSE** — **`GET /sse`** + **`POST /messages?sessionId=...`** for clients (including many Cursor remote setups) that expect the older HTTP+SSE transport.

This package is **client-agnostic**: anything that speaks MCP can use it.

## Features (MCP surfaces)

| Surface | Purpose |
|--------|---------|
| **Resources** | `skills://skill/{skillId}` — discover via template listing; bodies are Markdown. |
| **Tools** | `list_skills`, `get_skill`, `search_skills` |
| **Prompts** | `skill_context` — wraps a skill in a user message |

Skill ids are the POSIX path from `SKILLS_ROOT` to the folder containing `SKILL.md` (root-level file uses id `_root`).

## Quick start (local stdio)

```bash
npm install
npm run build
```

Default **`skills/`** includes packs copied from **`.cursor/skills`** in this repo. Add more folders with `SKILL.md` as needed. Run:

```bash
npx skills-mcp-server
# or: node dist/main.js
```

In **Cursor** MCP settings, use command-based config with `MCP_TRANSPORT` unset or `stdio`:

```json
{
  "mcpServers": {
    "skills": {
      "command": "node",
      "args": ["C:/absolute/path/to/skills-mcp-server/dist/main.js"],
      "env": {
        "SKILLS_ROOT": "C:/absolute/path/to/your/skills"
      }
    }
  }
}
```

## Remote (hosted — Cursor without local stdio)

Use **`HOSTING_AND_CURSOR.md`** for free-tier hosts (Render, Railway, Fly, Koyeb, etc.), env vars, and **Cursor `mcp.json` with `url` + `headers`**.

Endpoints (same host, HTTPS):

- **Streamable HTTP:** `https://your-host/mcp`
- **Legacy SSE (often best for Cursor remote):** `https://your-host/sse` (messages go to `/messages`)

Health: **`GET https://your-host/health`**. Env reference: **`env.example`**.

## Claude / other clients

Any MCP client that supports **stdio** or **Streamable HTTP** can attach the same server. Configure the vendor’s “remote MCP” or “HTTP MCP” entry with your HTTPS URL and bearer token if enabled.

## Documentation

- **`HOSTING_AND_CURSOR.md`** — free hosting, env vars, Cursor remote MCP (`url` / SSE vs streamable).
- **`DEPLOYMENT.md`** — Docker, Compose, reverse proxy, operational checklist.

## License

MIT.
