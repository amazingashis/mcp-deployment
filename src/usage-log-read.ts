import fs from "node:fs/promises";
import type { UsageEvent } from "./usage-tracker.js";

export async function readRecentUsageEntries(
  logPath: string,
  limit: number,
): Promise<UsageEvent[]> {
  let raw = "";
  try {
    raw = await fs.readFile(logPath, "utf8");
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    throw e;
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const slice =
    lines.length > limit ? lines.slice(lines.length - limit, lines.length) : lines.slice();

  const rows: UsageEvent[] = [];
  for (const line of slice) {
    try {
      rows.push(JSON.parse(line) as UsageEvent);
    } catch {
      /* skip malformed NDJSON rows */
    }
  }
  rows.reverse();
  return rows;
}
