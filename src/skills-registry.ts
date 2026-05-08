import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type SkillManifestEntry = {
  /** Stable id (posix relative path from skills root, without SKILL.md) */
  id: string;
  /** Absolute path to SKILL.md */
  filePath: string;
  /** Optional title from first # heading */
  title?: string;
  /** First paragraph or truncated body */
  description: string;
};

const SKILL_FILENAME = "SKILL.md";

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

async function walkSkillFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile() && ent.name === SKILL_FILENAME) {
        results.push(full);
      }
    }
  }
  await walk(root);
  return results;
}

function extractTitleAndTeaser(markdown: string): { title?: string; description: string } {
  const lines = markdown.split(/\r?\n/);
  let title: string | undefined;
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+)/);
    if (m) {
      title = m[1].trim();
      bodyStart = i + 1;
      break;
    }
  }
  const rest = lines.slice(bodyStart).join("\n").trim();
  const teaser =
    rest.length > 600 ? `${rest.slice(0, 600).trim()}…` : rest || title || "";
  return { title, description: teaser };
}

export class SkillsRegistry {
  constructor(private readonly skillsRoot: string) {}

  /** Canonical URI scheme for MCP resources */
  static readonly URI_SCHEME = "skills";

  skillUri(skillId: string): string {
    return `${SkillsRegistry.URI_SCHEME}://skill/${encodeURIComponent(skillId)}`;
  }

  parseSkillUri(uri: string): string | null {
    try {
      const u = new URL(uri);
      if (u.protocol !== `${SkillsRegistry.URI_SCHEME}:`) return null;
      const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
      if (parts[0] !== "skill" || parts.length !== 2) return null;
      return decodeURIComponent(parts[1]);
    } catch {
      return null;
    }
  }

  async listSkills(): Promise<SkillManifestEntry[]> {
    const root = this.skillsRoot;
    let stat;
    try {
      stat = await fs.stat(root);
    } catch {
      return [];
    }
    if (!stat.isDirectory()) return [];

    const files = await walkSkillFiles(root);
    const out: SkillManifestEntry[] = [];

    for (const filePath of files) {
      const relDir = path.relative(root, path.dirname(filePath));
      /** SKILL.md directly under SKILLS_ROOT */
      const normalizedId = relDir === "" ? "_root" : toPosix(relDir);

      let raw: string;
      try {
        raw = await fs.readFile(filePath, "utf8");
      } catch {
        continue;
      }
      const { title, description } = extractTitleAndTeaser(raw);
      out.push({
        id: normalizedId,
        filePath,
        title,
        description,
      });
    }

    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }

  async getSkillMarkdown(skillId: string): Promise<string | null> {
    const list = await this.listSkills();
    const hit = list.find((s) => s.id === skillId);
    if (!hit) return null;
    try {
      return await fs.readFile(hit.filePath, "utf8");
    } catch {
      return null;
    }
  }

  async search(query: string): Promise<SkillManifestEntry[]> {
    const q = query.trim().toLowerCase();
    const all = await this.listSkills();
    if (!q) return all;
    return all.filter((s) => {
      const blob = `${s.id}\n${s.title ?? ""}\n${s.description}`.toLowerCase();
      return blob.includes(q);
    });
  }
}
