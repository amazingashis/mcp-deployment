import crypto from "node:crypto";
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

function parseExtraHeaderNames(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function truthyEnv(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
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
  /**
   * When true, append usage events (tools/resources/prompts + MCP client metadata) as NDJSON.
   * Do not enable for PHI workloads without security review.
   */
  usageTrackingEnabled: boolean;
  /** Destination file for usage NDJSON lines (created append-only). */
  usageLogPath: string;
  /**
   * Comma-separated HTTP header names (case-insensitive) to record as salted hashes
   * (for optional workspace/project identifiers from your reverse proxy or client).
   */
  usageExtraHeaderNames: string[];
  /** Salt for hashing tokens and IPs (set MCP_USAGE_HASH_SALT in production so hashes survive restarts). */
  usageHashSalt: string;
  /** When true (HTTP mode only), serve a Basic Auth HTML dashboard for the usage NDJSON log. */
  usageWebEnabled: boolean;
  /** Mount path for the usage UI (e.g. /usage). */
  usageWebMountPath: string;
  /** Basic Auth username for the usage UI. */
  usageWebUser: string;
  /** Basic Auth password for the usage UI. */
  usageWebPassword: string;
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
  const usageTrackingExplicit =
    process.env.MCP_USAGE_TRACKING !== undefined &&
    String(process.env.MCP_USAGE_TRACKING).trim().length > 0;
  const usageLogPathRaw = process.env.MCP_USAGE_LOG?.trim();
  const usageTrackingEnabled = usageTrackingExplicit
    ? truthyEnv(process.env.MCP_USAGE_TRACKING)
    : Boolean(usageLogPathRaw?.length);

  const usageLogPath = path.resolve(
    process.cwd(),
    usageLogPathRaw ?? "reports/skills-mcp-usage.ndjson",
  );
  const usageExtraHeaderNames = parseExtraHeaderNames(process.env.MCP_USAGE_EXTRA_HEADERS);
  const usageHashSalt =
    process.env.MCP_USAGE_HASH_SALT?.trim() || crypto.randomUUID();

  const usageWebEnabled = truthyEnv(process.env.MCP_USAGE_WEB);
  const usageWebMountPath = (process.env.MCP_USAGE_WEB_PATH?.trim() || "/usage").replace(
    /\/+$/,
    "",
  );
  const usageWebUser = process.env.MCP_USAGE_WEB_USER?.trim() || "cursor";
  const usageWebPassword = process.env.MCP_USAGE_WEB_PASSWORD?.trim() || "cursor";

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
    usageTrackingEnabled,
    usageLogPath,
    usageExtraHeaderNames,
    usageHashSalt,
    usageWebEnabled,
    usageWebMountPath:
      usageWebMountPath.startsWith("/") ? usageWebMountPath : `/${usageWebMountPath}`,
    usageWebUser,
    usageWebPassword,
  };
}
