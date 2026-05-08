import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerConfig } from "./config.js";
import { SkillsRegistry } from "./skills-registry.js";

const INSTRUCTIONS = `This server exposes Cursor-style agent skills as MCP resources and tools.
Workflow: call list_skills or read resources under skills://skill/{id}; use get_skill to fetch full SKILL.md text for injection into the agent context.
Prefer resources for discovery; use tools when the client does not list resources.`;

export function createSkillsMcpServer(config: ServerConfig): McpServer {
  const registry = new SkillsRegistry(config.skillsRoot);

  const server = new McpServer(
    { name: config.serverName, version: config.serverVersion },
    {
      instructions: INSTRUCTIONS,
      capabilities: {
        resources: { subscribe: false, listChanged: false },
        tools: {},
        prompts: {},
      },
    },
  );

  const skillTemplate = new ResourceTemplate("skills://skill/{skillId}", {
    list: async () => {
      const skills = await registry.listSkills();
      return {
        resources: skills.map((s) => ({
          uri: registry.skillUri(s.id),
          name: s.title ?? s.id,
          title: s.title,
          description: s.description,
          mimeType: "text/markdown",
        })),
      };
    },
    complete: {
      skillId: async () => {
        const skills = await registry.listSkills();
        return skills.map((s) => s.id);
      },
    },
  });

  server.registerResource(
    "skill",
    skillTemplate,
    {
      description: "Markdown body of a skill (SKILL.md)",
      mimeType: "text/markdown",
    },
    async (uri, _vars) => {
      const id = registry.parseSkillUri(uri.toString());
      if (!id) {
        return {
          contents: [],
        };
      }
      const text = await registry.getSkillMarkdown(id);
      if (!text) {
        return {
          contents: [],
        };
      }
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text,
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_skills",
    {
      description:
        "Return a manifest of available skills (id, title, description teaser). No filesystem paths are exposed.",
      inputSchema: {},
    },
    async () => {
      const skills = await registry.listSkills();
      const lines = skills.map(
        (s) =>
          `- **${s.id}**${s.title ? `: ${s.title}` : ""}\n  ${s.description.replace(/\s+/g, " ").slice(0, 280)}`,
      );
      return {
        content: [
          {
            type: "text",
            text:
              lines.length > 0
                ? lines.join("\n\n")
                : "No skills found. Mount SKILL.md files under SKILLS_ROOT (see server README).",
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_skill",
    {
      description: "Load the full SKILL.md contents for a skill id.",
      inputSchema: {
        skill_id: z.string().describe("Skill id as returned by list_skills"),
      },
    },
    async ({ skill_id }) => {
      const text = await registry.getSkillMarkdown(skill_id);
      if (!text) {
        return {
          content: [{ type: "text", text: `Skill not found: ${skill_id}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text }],
      };
    },
  );

  server.registerTool(
    "search_skills",
    {
      description: "Filter skills by free-text query over id, title, and description.",
      inputSchema: {
        query: z.string().describe("Case-insensitive substring match"),
      },
    },
    async ({ query }) => {
      const found = await registry.search(query);
      const lines = found.map(
        (s) =>
          `- **${s.id}**${s.title ? `: ${s.title}` : ""}\n  ${s.description.replace(/\s+/g, " ").slice(0, 280)}`,
      );
      return {
        content: [
          {
            type: "text",
            text:
              lines.length > 0
                ? lines.join("\n\n")
                : `No skills matched query: ${query}`,
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "skill_context",
    {
      description: "Build a user message that embeds a skill for the model.",
      argsSchema: {
        skill_id: z.string().describe("Skill id from list_skills"),
      },
    },
    async ({ skill_id }) => {
      const text = await registry.getSkillMarkdown(skill_id);
      if (!text) {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Unknown skill_id: ${skill_id}`,
              },
            },
          ],
        };
      }
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Follow the skill below. Treat it as authoritative for this task.\n\n---\n\n${text}`,
            },
          },
        ],
      };
    },
  );

  return server;
}
