import fs from "node:fs/promises";
import path from "node:path";
import type { ServerConfig } from "./config.js";
import { getUsageContext } from "./usage-context.js";

/** One NDJSON line; no raw queries, paths, tokens, or message bodies. */
export type UsageEvent = {
  ts: string;
  event: "mcp_initialized" | "tool_call" | "resource_read" | "prompt_call";
  /** Tool name, logical resource name, or prompt name */
  name?: string;
  interactionId?: string;
  transport?: string;
  authCredentialHash?: string;
  sseSessionHash?: string;
  remoteAddressHash?: string;
  userAgent?: string;
  host?: string;
  httpPath?: string;
  clientName?: string;
  clientVersion?: string;
  clientCapabilityKeys?: string[];
  extraHeaders?: Record<string, string>;
  /** Safe argument hints only */
  skillId?: string;
  searchQueryLen?: number;
};

function baseFields(): Omit<UsageEvent, "ts" | "event"> {
  const c = getUsageContext();
  if (!c) return {};
  return {
    interactionId: c.interactionId,
    transport: c.transport,
    authCredentialHash: c.authCredentialHash,
    sseSessionHash: c.sseSessionHash,
    remoteAddressHash: c.remoteAddressHash,
    userAgent: c.userAgent,
    host: c.host,
    httpPath: c.httpPath,
    clientName: c.clientName,
    clientVersion: c.clientVersion,
    clientCapabilityKeys: c.clientCapabilityKeys,
    extraHeaders: c.extraHeaders,
  };
}

export class UsageTracker {
  private readonly logPath: string;
  private ensuredDir = false;

  constructor(cfg: Pick<ServerConfig, "usageLogPath">) {
    this.logPath = cfg.usageLogPath;
  }

  static fromConfig(
    cfg: ServerConfig,
  ): UsageTracker | undefined {
    if (!cfg.usageTrackingEnabled) return undefined;
    return new UsageTracker(cfg);
  }

  /** Populated once MCP client completes handshake (caller reads from `server.server`). */
  attachClientHints(client?: { name: string; version: string }, capabilityKeys?: string[]): void {
    const store = getUsageContext();
    if (!store) return;
    if (client?.name) store.clientName = client.name;
    if (client?.version) store.clientVersion = client.version;
    if (capabilityKeys?.length) store.clientCapabilityKeys = capabilityKeys;
  }

  private async ensureParentDirOnce(): Promise<void> {
    if (this.ensuredDir) return;
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    this.ensuredDir = true;
  }

  append(event: Omit<UsageEvent, "ts"> & { ts?: string }): void {
    const row: UsageEvent = {
      ts: event.ts ?? new Date().toISOString(),
      ...baseFields(),
      ...event,
    };

    void (async (): Promise<void> => {
      try {
        await this.ensureParentDirOnce();
        await fs.appendFile(this.logPath, JSON.stringify(row) + "\n", "utf8");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[skills-mcp-server] usage log write failed: ${msg}\n`);
      }
    })();
  }

  recordMcpInitialized(): void {
    this.append({
      event: "mcp_initialized",
    });
  }

  recordToolCall(
    toolName: string,
    payload: { skill_id?: string; query?: string },
  ): void {
    const hints: Omit<UsageEvent, "ts" | "event"> = {
      name: toolName,
    };
    if (typeof payload.skill_id === "string" && payload.skill_id) {
      hints.skillId = payload.skill_id.slice(0, 256);
    }
    if (typeof payload.query === "string") {
      hints.searchQueryLen = payload.query.length;
    }
    this.append({ event: "tool_call", ...hints });
  }

  recordResourceRead(name: string, skillId?: string): void {
    this.append({
      event: "resource_read",
      name,
      ...(skillId ? { skillId: skillId.slice(0, 256) } : {}),
    });
  }

  recordPrompt(promptName: string, skill_id?: string): void {
    this.append({
      event: "prompt_call",
      name: promptName,
      ...(skill_id ? { skillId: skill_id.slice(0, 256) } : {}),
    });
  }
}

export function capabilityKeyList(caps: Record<string, unknown> | undefined): string[] | undefined {
  if (!caps || typeof caps !== "object") return undefined;
  return Object.entries(caps)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k]) => k)
    .sort();
}
