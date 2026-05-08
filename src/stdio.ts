import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerConfig } from "./config.js";
import { createSkillsMcpServer } from "./create-server.js";
import { runWithUsageContextAsync, stdioUsageContext } from "./usage-context.js";
import { UsageTracker } from "./usage-tracker.js";

export async function runStdio(config: ServerConfig): Promise<void> {
  const usageTracker = UsageTracker.fromConfig(config);
  if (usageTracker) {
    process.stderr.write(
      `[skills-mcp-server] Usage tracking enabled → NDJSON append: ${config.usageLogPath}\n`,
    );
  }
  const uctx = stdioUsageContext();

  await runWithUsageContextAsync(uctx, async () => {
    const transport = new StdioServerTransport();
    const server = createSkillsMcpServer(config, { usageTracker });
    await server.connect(transport);
  });
}
