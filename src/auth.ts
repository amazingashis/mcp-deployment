import crypto from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Static bearer token gate for remote deployments.
 * Prefer OAuth / MCP authorization spec for production; this covers simple VPS setups.
 */
export function createBearerAuthMiddleware(expectedToken: string | undefined): RequestHandler {
  const buf = expectedToken ? Buffer.from(expectedToken, "utf8") : undefined;

  return (req, res, next) => {
    if (!buf?.length) {
      return next();
    }
    const header = req.headers.authorization;
    const prefix = "Bearer ";
    if (!header?.startsWith(prefix)) {
      res.status(401).setHeader("WWW-Authenticate", 'Bearer charset="UTF-8"');
      res.end("Unauthorized");
      return;
    }
    const presented = Buffer.from(header.slice(prefix.length).trim(), "utf8");
    if (presented.length !== buf.length || !crypto.timingSafeEqual(presented, buf)) {
      res.status(401).setHeader("WWW-Authenticate", 'Bearer charset="UTF-8"');
      res.end("Unauthorized");
      return;
    }
    next();
  };
}
