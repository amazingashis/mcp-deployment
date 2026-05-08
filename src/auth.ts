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
    const send401 = (): void => {
      res.status(401);
      res.setHeader("WWW-Authenticate", 'Bearer realm="skills-mcp", charset="UTF-8"');
      res.json({
        error: "invalid_token",
        message:
          "Bearer token rejected — value must match MCP_AUTH_TOKEN on Render exactly. OAuth /register is not supported.",
      });
    };

    if (!header?.startsWith(prefix)) {
      send401();
      return;
    }
    const presented = Buffer.from(header.slice(prefix.length).trim(), "utf8");
    if (presented.length !== buf.length || !crypto.timingSafeEqual(presented, buf)) {
      send401();
      return;
    }
    next();
  };
}
