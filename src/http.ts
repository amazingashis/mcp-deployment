import crypto from "node:crypto";
import type { Server } from "node:http";
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { ServerConfig } from "./config.js";
import { createSkillsMcpServer } from "./create-server.js";
import { createBearerAuthMiddleware } from "./auth.js";
import type { UsageContext } from "./usage-context.js";
import { buildUsageContextFromHttp, runWithUsageContextAsync } from "./usage-context.js";
import { UsageTracker } from "./usage-tracker.js";
import { attachUsageWeb } from "./usage-web.js";

type SseSession = {
  transport: SSEServerTransport;
  usageCtx: UsageContext;
};

/** Legacy HTTP+SSE sessions (Cursor and older MCP clients often use GET /sse + POST /messages). */
const sseSessions = new Map<string, SseSession>();

export async function startHttpServer(config: ServerConfig): Promise<Server> {
  const expressOptions =
    config.host === "0.0.0.0" || config.host === "::"
      ? {
          host: config.host,
          allowedHosts: config.allowedHosts,
        }
      : { host: config.host };

  const app = createMcpExpressApp(expressOptions);

  if (!config.authToken) {
    process.stderr.write(
      "[skills-mcp-server] WARNING: MCP_AUTH_TOKEN is unset; MCP routes are unauthenticated. Use TLS and a token in production.\n",
    );
  }

  const authMiddleware = createBearerAuthMiddleware(config.authToken);
  const usageTracker = UsageTracker.fromConfig(config);

  if (usageTracker) {
    process.stderr.write(
      `[skills-mcp-server] Usage tracking enabled → NDJSON append: ${config.usageLogPath}\n`,
    );
  }

  attachUsageWeb(app, config);

  /** Cursor tries OAuth client registration after 401; we are Bearer-only — return JSON instead of HTML. */
  app.post("/register", (_req, res) => {
    res.status(404).json({
      error: "not_supported",
      message:
        "OAuth dynamic registration is disabled. Use Authorization: Bearer <MCP_AUTH_TOKEN> and match Render secrets.",
    });
  });

  /** Browsers hit `/` by default; Express otherwise responds with "Cannot GET /". */
  app.get("/", (_req, res) => {
    res.json({
      service: config.serverName,
      version: config.serverVersion,
      message:
        "This is an MCP server, not a web app. Configure your MCP client (e.g. Cursor) to use POST /mcp or GET /sse on this host.",
      paths: {
        health: config.healthPath,
        streamableHttp: "/mcp",
        sse: "/sse",
        sseMessages: "/messages",
        ...(config.usageWebEnabled ? { usageWebUi: `${config.usageWebMountPath} (Basic Auth)` } : {}),
      },
    });
  });

  /** Intentionally unauthenticated for orchestrator probes; keep MCP behind MCP_AUTH_TOKEN + TLS. */
  app.get(config.healthPath, (_req, res) => {
    res.json({
      ok: true,
      service: config.serverName,
      version: config.serverVersion,
      endpoints: {
        streamableHttp: "/mcp",
        sse: "/sse",
        sseMessages: "/messages",
      },
    });
  });

  const mcpPath = "/mcp";
  const ssePath = "/sse";
  const messagesPath = "/messages";

  /** Cursor probes Streamable HTTP with POST on the same URL as SSE (`/sse`). */
  const handleStreamableHttpPost = async (req: Request, res: Response): Promise<void> => {
    const interactionId = crypto.randomUUID();
    const httpCtx = buildUsageContextFromHttp(req, {
      interactionId,
      hashSalt: config.usageHashSalt,
      extraHeaderNames: config.usageExtraHeaderNames,
    });

    await runWithUsageContextAsync(httpCtx, async () => {
      const mcp = createSkillsMcpServer(config, { usageTracker });
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        await mcp.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on("close", () => {
          void transport.close();
          void mcp.close();
        });
      } catch (err) {
        console.error("[skills-mcp-server] MCP request error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    });
  };

  app.post(mcpPath, authMiddleware, handleStreamableHttpPost);
  app.post(ssePath, authMiddleware, handleStreamableHttpPost);

  app.get(mcpPath, authMiddleware, (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed for GET; initialize via POST (streamable HTTP).",
      },
      id: null,
    });
  });

  app.get(ssePath, authMiddleware, async (req, res) => {
    const interactionId = crypto.randomUUID();
    const transport = new SSEServerTransport(messagesPath, res);
    const sseCtx = buildUsageContextFromHttp(req, {
      interactionId,
      sseSessionId: transport.sessionId,
      hashSalt: config.usageHashSalt,
      extraHeaderNames: config.usageExtraHeaderNames,
    });
    sseSessions.set(transport.sessionId, { transport, usageCtx: sseCtx });

    await runWithUsageContextAsync(sseCtx, async () => {
      const mcp = createSkillsMcpServer(config, { usageTracker });
      res.on("close", () => {
        sseSessions.delete(transport.sessionId);
        void mcp.close();
      });
      try {
        await mcp.connect(transport);
      } catch (err) {
        console.error("[skills-mcp-server] SSE connect error:", err);
        sseSessions.delete(transport.sessionId);
        if (!res.headersSent) {
          res.status(500).end("SSE setup failed");
        }
      }
    });
  });

  app.post(messagesPath, authMiddleware, async (req, res) => {
    const raw = req.query.sessionId;
    const sessionId =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw) && typeof raw[0] === "string"
          ? raw[0]
          : undefined;
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing sessionId query parameter" },
        id: null,
      });
      return;
    }
    const session = sseSessions.get(sessionId);
    if (!session) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unknown SSE session" },
        id: null,
      });
      return;
    }
    try {
      await runWithUsageContextAsync(session.usageCtx, async () => {
        await session.transport.handlePostMessage(req, res, req.body);
      });
    } catch (err) {
      console.error("[skills-mcp-server] SSE message error:", err);
      if (!res.headersSent) {
        res.status(500).end("Internal server error");
      }
    }
  });

  return await new Promise((resolve, reject) => {
    const srv = app.listen(config.port, config.host, () => resolve(srv));
    srv.on("error", reject);
  });
}
