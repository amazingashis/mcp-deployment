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
    const header = req.headers.authorization?.trim();
    const prefix = /^Bearer\s+/i;
    const send401 = (): void => {
      res.status(401);
      res.setHeader("WWW-Authenticate", 'Bearer realm="skills-mcp", charset="UTF-8"');
      res.json({
        error: "invalid_token",
        message:
          "Use Authorization: Bearer <MCP_AUTH_TOKEN> (note the word Bearer before your secret). Raw token-only works only if the header has no spaces.",
      });
    };

    if (!header?.length) {
      send401();
      return;
    }
    const credential = prefix.test(header)
      ? header.replace(prefix, "").trim()
      : header.trim();
    const presented = Buffer.from(credential, "utf8");
    if (presented.length !== buf.length || !crypto.timingSafeEqual(presented, buf)) {
      send401();
      return;
    }
    next();
  };
}
