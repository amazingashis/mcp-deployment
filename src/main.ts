#!/usr/bin/env node
import process from "node:process";
import { loadConfig } from "./config.js";
import { runStdio } from "./stdio.js";
import { startHttpServer } from "./http.js";

function transportMode(): "stdio" | "http" {
  const t = (process.env.MCP_TRANSPORT ?? "").toLowerCase();
  if (t === "http" || t === "streamable-http") return "http";
  if (t === "stdio") return "stdio";
  return "stdio";
}

async function main(): Promise<void> {
  const config = loadConfig();
  const mode = transportMode();

  if (mode === "http") {
    const srv = await startHttpServer(config);
    const addr = srv.address();
    const summary =
      typeof addr === "object" && addr && "port" in addr
        ? `http://${config.host}:${addr.port}/mcp`
        : `http://${config.host}:${config.port}/mcp`;
    process.stderr.write(`[skills-mcp-server] Listening (${summary})\n`);
    process.stderr.write(`[skills-mcp-server] Health: http://${config.host}:${config.port}${config.healthPath}\n`);

    const shutdown = (): void => {
      srv.close(() => process.exit(0));
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  await runStdio(config);
}

main().catch((err) => {
  console.error("[skills-mcp-server] Fatal:", err);
  process.exit(1);
});
