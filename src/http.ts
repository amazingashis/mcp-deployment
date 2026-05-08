import type { Server } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { ServerConfig } from "./config.js";
import { createSkillsMcpServer } from "./create-server.js";
import { createBearerAuthMiddleware } from "./auth.js";

/** Legacy HTTP+SSE sessions (Cursor and older MCP clients often use GET /sse + POST /messages). */
const sseSessions = new Map<string, SSEServerTransport>();

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

  app.post(mcpPath, authMiddleware, async (req, res) => {
    const mcp = createSkillsMcpServer(config);
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

  app.get(ssePath, authMiddleware, async (_req, res) => {
    const mcp = createSkillsMcpServer(config);
    const transport = new SSEServerTransport(messagesPath, res);
    sseSessions.set(transport.sessionId, transport);
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
    const transport = sseSessions.get(sessionId);
    if (!transport) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Unknown SSE session" },
        id: null,
      });
      return;
    }
    try {
      await transport.handlePostMessage(req, res, req.body);
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
