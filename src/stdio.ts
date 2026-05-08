import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ServerConfig } from "./config.js";
import { createSkillsMcpServer } from "./create-server.js";

export async function runStdio(config: ServerConfig): Promise<void> {
  const transport = new StdioServerTransport();
  const server = createSkillsMcpServer(config);
  await server.connect(transport);
}
