import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import type { Request } from "express";

export type UsageTransport = "http" | "stdio";

/** Per-connection or per-request context; avoid storing raw PHI/PII — use hashes only. */
export type UsageContext = {
  transport: UsageTransport;
  /** Correlates all events from one MCP server instance (one HTTP POST or one SSE session). */
  interactionId: string;
  /** Short hash of Bearer credential (differentiates API keys without storing secrets). */
  authCredentialHash?: string;
  /** Stable hash derived from SSE session id when applicable. */
  sseSessionHash?: string;
  /** Hash of Express req.socket.remoteAddress (or forwarded chain). */
  remoteAddressHash?: string;
  userAgent?: string;
  /** Host header from HTTP (lowercase). */
  host?: string;
  /** Request path for HTTP MCP entrypoint, e.g. /mcp or /sse */
  httpPath?: string;
  /** From MCP clientInfo after initialize */
  clientName?: string;
  clientVersion?: string;
  /** Top-level MCP client capability keys after initialize */
  clientCapabilityKeys?: string[];
  /** Hashed optional headers (names from MCP_USAGE_EXTRA_HEADERS) */
  extraHeaders?: Record<string, string>;
};

const storage = new AsyncLocalStorage<UsageContext>();

export function runWithUsageContext<T>(ctx: UsageContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export async function runWithUsageContextAsync<T>(ctx: UsageContext, fn: () => Promise<T>): Promise<T> {
  return await storage.run(ctx, fn);
}

export function getUsageContext(): UsageContext | undefined {
  return storage.getStore();
}

export function shortHash(input: string, salt: string): string {
  const h = crypto.createHash("sha256");
  h.update(salt);
  h.update("|");
  h.update(input);
  return h.digest("hex").slice(0, 16);
}

function bearerCredential(req: Request): string | undefined {
  const header = req.headers.authorization?.trim();
  if (!header) return undefined;
  const prefix = /^Bearer\s+/i;
  const credential = prefix.test(header) ? header.replace(prefix, "").trim() : header.trim();
  return credential || undefined;
}

function forwardedForTail(req: Request): string | undefined {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const parts = xff.split(",").map((s) => s.trim());
    return parts[parts.length - 1];
  }
  return undefined;
}

function pickRemoteHint(req: Request): string | undefined {
  return forwardedForTail(req) ?? req.socket.remoteAddress ?? undefined;
}

/**
 * Builds usage context from an authenticated HTTP request. Call inside the MCP handler after auth.
 */
export function buildUsageContextFromHttp(
  req: Request,
  opts: {
    interactionId: string;
    sseSessionId?: string;
    hashSalt: string;
    extraHeaderNames: string[];
  },
): UsageContext {
  const remote = pickRemoteHint(req);
  const cred = bearerCredential(req);
  const extra: Record<string, string> = {};
  for (const name of opts.extraHeaderNames) {
    const v = req.headers[name];
    if (typeof v === "string" && v.trim()) {
      extra[name] = shortHash(v.trim(), `${opts.hashSalt}:${name}`);
    }
  }
  const hostRaw = req.headers.host;
  return {
    transport: "http",
    interactionId: opts.interactionId,
    authCredentialHash: cred ? shortHash(cred, opts.hashSalt) : undefined,
    sseSessionHash: opts.sseSessionId ? shortHash(opts.sseSessionId, `${opts.hashSalt}:sse`) : undefined,
    remoteAddressHash: remote ? shortHash(remote, `${opts.hashSalt}:ip`) : undefined,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    host: typeof hostRaw === "string" ? hostRaw.toLowerCase() : undefined,
    httpPath: req.path || undefined,
    extraHeaders: Object.keys(extra).length ? extra : undefined,
  };
}

export function stdioUsageContext(): UsageContext {
  return {
    transport: "stdio",
    interactionId: crypto.randomUUID(),
  };
}
