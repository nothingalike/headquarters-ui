import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { EntryKind, TreeNode } from "../shared/types.ts";

/** Folders and files the app never shows or indexes. */
const HIDDEN = new Set([".git", "node_modules", ".obsidian", ".vscode", "Thumbs.db", "desktop.ini"]);

export function isHidden(name: string): boolean {
  return HIDDEN.has(name) || name.startsWith(".");
}

/** Headquarters on disk. Every path in and out is relative, with forward slashes. */
export class Hq {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Resolves a relative path inside headquarters, or throws when it escapes the root or names a hidden file. */
  resolve(rel: string): string {
    const clean = rel.replace(/\\/g, "/").replace(/^\/+/, "");
    const abs = path.resolve(this.root, clean);
    const back = path.relative(this.root, abs);
    if (back.startsWith("..") || path.isAbsolute(back)) throw new PathError(rel);
    if (back.split(path.sep).some((part) => part && isHidden(part))) throw new PathError(rel);
    return abs;
  }

  relative(abs: string): string {
    return path.relative(this.root, abs).split(path.sep).join("/");
  }

  async tree(rel = ""): Promise<TreeNode[]> {
    const dir = this.resolve(rel);
    const entries = await readdir(dir, { withFileTypes: true });
    const nodes = await Promise.all(
      entries
        .filter((e) => !isHidden(e.name))
        .map(async (e): Promise<TreeNode> => {
          const childPath = rel ? `${rel}/${e.name}` : e.name;
          if (!e.isDirectory()) return { name: e.name, path: childPath, type: "file" };
          const children = await this.tree(childPath);
          const report = children.some((c) => c.type === "file" && (c.name === "index.html" || c.name === "report.json"));
          return { name: e.name, path: childPath, type: "dir", children, ...(report ? { report } : {}) };
        }),
    );
    return nodes.sort(compareNodes);
  }

  async exists(rel: string): Promise<boolean> {
    try {
      await stat(this.resolve(rel));
      return true;
    } catch {
      return false;
    }
  }
}

export class PathError extends Error {
  constructor(rel: string) {
    super(`Path is outside headquarters: ${rel}`);
  }
}

/** Folders before files; dated names (reports, logs) newest first; everything else A to Z. */
function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
  const dated = /^\d{4}-\d{2}-\d{2}/;
  if (dated.test(a.name) && dated.test(b.name)) return b.name.localeCompare(a.name);
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

const KINDS: Record<string, EntryKind> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".html": "html",
  ".htm": "html",
  ".json": "json",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".svg": "image",
};

const TEXT = new Set([".txt", ".log", ".sql", ".js", ".mjs", ".ts", ".mts", ".css", ".csv", ".yaml", ".yml", ".sh", ".rpt", ".gitignore", ""]);

export function kindOf(name: string): EntryKind {
  const ext = path.extname(name).toLowerCase();
  return KINDS[ext] ?? (TEXT.has(ext) ? "text" : "binary");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};

export function mimeOf(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return MIME[ext] ?? (kindOf(name) === "text" ? "text/plain; charset=utf-8" : "application/octet-stream");
}
