import crypto from "node:crypto";
import type { Application, NextFunction, Request, Response } from "express";
import express from "express";
import type { ServerConfig } from "./config.js";
import { readRecentUsageEntries } from "./usage-log-read.js";

function normalizeWebMount(path: string): string {
  const p = path.trim().replace(/\/+$/, "") || "/usage";
  return p.startsWith("/") ? p : `/${p}`;
}

function parseBasicAuth(header: string | undefined): {
  username: string;
  password: string;
} | null {
  const h = header?.trim();
  if (!h?.startsWith("Basic ")) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(h.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return null;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  return {
    username: decoded.slice(0, colon),
    password: decoded.slice(colon + 1),
  };
}

function timingSafeStringsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createBasicAuthGate(expectedUser: string, expectedPassword: string): express.RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const presented = parseBasicAuth(_req.headers.authorization);
    if (
      presented &&
      timingSafeStringsEqual(presented.username, expectedUser) &&
      timingSafeStringsEqual(presented.password, expectedPassword)
    ) {
      next();
      return;
    }

    res.status(401);
    res.setHeader("WWW-Authenticate", 'Basic realm="Skills MCP Usage", charset="UTF-8"');
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(
      `<!DOCTYPE html><html><body><p>Unauthorized</p><p>Use the Usage dashboard credentials (defaults: MCP_USAGE_WEB_USER / MCP_USAGE_WEB_PASSWORD).</p></body></html>`,
    );
  };
}

/** Single-page viewer; fetched data never includes raw Bearer tokens — only hashed fields already in NDJSON */
function viewerHtml(webMount: string): string {
  const api = `${webMount.replace(/\/$/, "")}/api/events`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Skills MCP — usage</title>
  <style>
    :root { font-family: system-ui,Segoe UI,sans-serif; background: #111; color: #eee; }
    body { margin: 0; padding: 16px 20px 40px; max-width: 1400px; margin-inline: auto; }
    h1 { font-weight: 600; font-size: 1.25rem; margin: 0 0 12px; }
    .muted { color: #888; font-size: 0.875rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    input, button { background: #222; border: 1px solid #444; color: #eee; padding: 8px 12px; border-radius: 6px; font: inherit; }
    button:hover { border-color: #666; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #333; vertical-align: top; }
    th { color: #aaa; font-weight: 600; position: sticky; top: 0; background: #111; z-index: 1; }
    tr:hover td { background: #1a1a1a; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #2a2a2a; font-size: 12px; }
    .evt-init { border-color: #3b5bdb; color: #8da4ff; }
    .evt-tool { border-color: #2f9e44; color: #87f2a1; }
    .evt-resource { border-color: #fcc419; color: #fde79b; }
    .evt-prompt { border-color: #e8590c; color: #ffb37a; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 11px; color: #aaa; }
    .error { color: #ff6b6b; }
    /* “Agents” column = MCP client name/version from handshake */
  </style>
</head>
<body>
  <h1>Skills &amp; client usage</h1>
  <p class="muted">Rows come from NDJSON audit log. Tool calls map to skill usage (<code>get_skill</code>, <code>search_skills</code>, prompts, resources). <strong>MCP clients</strong> (e.g. Cursor) appear under Client — there are no distinct “agents” in this protocol.</p>
  <div class="toolbar">
    <label>Show last <input type="number" id="limit" min="50" max="5000" value="800" style="width:5rem"/></label>
    <button type="button" id="reload">Reload</button>
    <span class="muted" id="status"></span>
  </div>
  <div style="overflow-x:auto;">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Event</th>
          <th>Name / skill</th>
          <th>Client (app)</th>
          <th>Caller key</th>
          <th>Session</th>
          <th>Transport</th>
          <th>More</th>
        </tr>
      </thead>
      <tbody id="rows"><tr><td colspan="8" class="muted">Loading…</td></tr></tbody>
    </table>
  </div>
  <script>
    const apiUrl = "${api}";
    function pillClass(ev) {
      if (ev === "mcp_initialized") return "evt-init";
      if (ev === "tool_call") return "evt-tool";
      if (ev === "resource_read") return "evt-resource";
      if (ev === "prompt_call") return "evt-prompt";
      return "";
    }
    function esc(s) {
      return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }
    async function load() {
      const limitEl = document.getElementById("limit");
      const status = document.getElementById("status");
      const tbody = document.getElementById("rows");
      const btn = document.getElementById("reload");
      const limit = Math.min(5000, Math.max(50, Number(limitEl.value) || 800));
      limitEl.value = limit;
      status.textContent = "Fetching…";
      btn.disabled = true;
      tbody.innerHTML = '<tr><td colspan="8" class="muted">Loading…</td></tr>';
      try {
        const r = await fetch(apiUrl + "?limit=" + limit, { credentials: "same-origin" });
        if (r.status === 401) { tbody.innerHTML = '<tr><td colspan="8" class="error">Unauthorized — enter Basic Auth.</td></tr>'; status.textContent = ""; return; }
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        const rows = data.rows || [];
        if (rows.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="muted">No events yet. Ensure MCP_USAGE_TRACKING is enabled and the server has logged activity.</td></tr>';
          status.textContent = "0 rows";
          return;
        }
        status.textContent = rows.length + " rows (newest first)";
        tbody.innerHTML = rows.map(function (row) {
          const caps = Array.isArray(row.clientCapabilityKeys) ? row.clientCapabilityKeys.join(", ") : "";
          const extra = row.extraHeaders ? JSON.stringify(row.extraHeaders) : "";
          const more = [];
          if (caps) more.push("caps: " + caps);
          if (row.skillId && row.event !== "resource_read") more.push("skillId: " + row.skillId);
          if (row.searchQueryLen != null) more.push("queryLen: " + row.searchQueryLen);
          if (row.userAgent) more.push("ua: " + row.userAgent);
          if (row.host) more.push("host: " + row.host);
          if (row.httpPath) more.push("path: " + row.httpPath);
          if (row.sseSessionHash) more.push("sse: " + row.sseSessionHash);
          if (row.remoteAddressHash) more.push("ipH: " + row.remoteAddressHash);
          if (extra) more.push("headers: " + extra);
          const nameCell = row.name
            ? esc(row.name) + (row.skillId ? "<br/><span class=\\"muted\\">" + esc(row.skillId) + "</span>" : "")
            : esc(row.skillId || "—");
          const client = (row.clientName || row.clientVersion)
            ? esc(row.clientName || "—") + "<br/><span class=\\"muted\\">" + esc(row.clientVersion || "") + "</span>"
            : "—";
          return "<tr><td>" + esc(row.ts) + "</td><td><span class=\\"pill " + pillClass(row.event) + "\\">" + esc(row.event) + "</span></td><td>" + nameCell + "</td><td>" + client + "</td><td><code>" + esc(row.authCredentialHash || "—") + "</code></td><td><code style=\\"font-size:11px\\">" + esc(row.interactionId || "—") + "</code></td><td>" + esc(row.transport || "—") + "</td><td><pre>" + esc(more.join(" · ")) + "</pre></td></tr>";
        }).join("");
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" class="error">' + esc(e.message || e) + "</td></tr>";
        status.textContent = "";
      } finally {
        btn.disabled = false;
      }
    }
    document.getElementById("reload").addEventListener("click", load);
    load();
  </script>
</body>
</html>`;
}

export function attachUsageWeb(app: Application, config: ServerConfig): void {
  if (!config.usageWebEnabled) return;

  const mount = normalizeWebMount(config.usageWebMountPath);
  const gate = createBasicAuthGate(config.usageWebUser, config.usageWebPassword);

  const router = express.Router();
  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(viewerHtml(mount));
  });

  router.get("/api/events", async (req, res) => {
    const raw = Number.parseInt(String(req.query.limit ?? "800"), 10);
    const limit = Number.isFinite(raw) ? Math.min(5000, Math.max(50, raw)) : 800;
    try {
      const rows = await readRecentUsageEntries(config.usageLogPath, limit);
      res.setHeader("Cache-Control", "no-store");
      res.json({ rows, logPath: config.usageLogPath, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "read_failed", message: msg });
    }
  });

  app.use(mount, gate, router);

  const usingDefaults =
    config.usageWebUser === "cursor" && config.usageWebPassword === "cursor";
  if (usingDefaults) {
    process.stderr.write(
      "[skills-mcp-server] WARNING: Usage web UI uses default credentials (cursor/cursor). Set MCP_USAGE_WEB_USER / MCP_USAGE_WEB_PASSWORD and serve only over HTTPS.\n",
    );
  }
  process.stderr.write(`[skills-mcp-server] Usage web UI → http://<host>:<port>${mount} (Basic Auth)\n`);
}
