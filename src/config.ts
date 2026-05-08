import path from "node:path";

function normalizeAllowedHostEntry(entry: string): string {
  const h = entry.trim().replace(/\/+$/, "");
  if (!h) return "";
  try {
    if (h.includes("://")) {
      return new URL(h).hostname;
    }
  } catch {
    /* fall through */
  }
  return h;
}

function parseAllowedHosts(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const list = raw
    .split(",")
    .map((h) => normalizeAllowedHostEntry(h))
    .filter(Boolean);
  /** Empty array would still enable host middleware and reject every request */
  if (list.length === 0) return undefined;
  return list;
}

export type ServerConfig = {
  /** filesystem root containing skill packages (folders with SKILL.md) */
  skillsRoot: string;
  /** MCP Streamable HTTP listen port (http mode) */
  port: number;
  /** Bind address; use 0.0.0.0 in containers */
  host: string;
  /** Path prefix for health (GET only); MCP stays at /mcp */
  healthPath: string;
  /**
   * When set, require `Authorization: Bearer <token>` on /mcp.
   * Use only with TLS termination in front of the server.
   */
  authToken?: string;
  /** Hostnames allowed for Host header (DNS rebinding); required when exposing publicly */
  allowedHosts?: string[];
  /** Server name in MCP initialize */
  serverName: string;
  /** Semver string advertised to clients */
  serverVersion: string;
};

export function loadConfig(): ServerConfig {
  const skillsRoot = path.resolve(
    process.env.SKILLS_ROOT ?? path.join(process.cwd(), "skills"),
  );
  const port = Number(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? "8787");
  const host = process.env.HOST ?? "127.0.0.1";
  const healthPath = process.env.HEALTH_PATH ?? "/health";
  const authToken = process.env.MCP_AUTH_TOKEN?.trim() || undefined;
  const allowedHosts = parseAllowedHosts(process.env.MCP_ALLOWED_HOSTS);
  const serverName = process.env.MCP_SERVER_NAME ?? "skills-mcp-server";
  const serverVersion = process.env.MCP_SERVER_VERSION ?? "1.0.0";

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT ?? process.env.MCP_HTTP_PORT}`);
  }

  return {
    skillsRoot,
    port,
    host,
    healthPath,
    authToken,
    allowedHosts,
    serverName,
    serverVersion,
  };
}
