import { readFile, stat } from "node:fs/promises";
import MiniSearch from "minisearch";
import { isTodo } from "../shared/reports.ts";
import type { SearchHit, TreeNode, TypedReport } from "../shared/types.ts";
import { type Hq, kindOf } from "./hq.ts";

type Doc = { id: string; title: string; text: string; project: string; kind: string };

const MAX_BYTES = 2_000_000;

/** Full-text index over the Markdown, HTML, and typed reports in headquarters. */
export class SearchIndex {
  private readonly hq: Hq;
  private docs = new Map<string, Doc>();
  private mini = newMini();

  constructor(hq: Hq) {
    this.hq = hq;
  }

  async build(tree: TreeNode[]): Promise<void> {
    this.mini = newMini();
    this.docs.clear();
    const files = flatten(tree).filter(indexable);
    await Promise.all(files.map((f) => this.update(f)));
  }

  /** Adds, refreshes, or drops one file. */
  async update(rel: string): Promise<void> {
    if (this.docs.has(rel)) {
      this.mini.discard(rel);
      this.docs.delete(rel);
    }
    if (!indexable(rel)) return;
    const doc = await this.load(rel).catch(() => undefined);
    if (!doc) return;
    this.docs.set(rel, doc);
    this.mini.add(doc);
  }

  search(query: string, limit = 30): SearchHit[] {
    const q = query.trim();
    if (!q) return [];
    const terms = q.toLowerCase().split(/\s+/);
    return this.mini
      .search(q, { prefix: true, fuzzy: 0.15, combineWith: "AND", boost: { title: 3, id: 2 } })
      .slice(0, limit)
      .map((r) => {
        const doc = this.docs.get(r.id)!;
        return { path: doc.id, title: doc.title, kind: doc.kind, project: doc.project, snippet: snippet(doc.text, terms), score: r.score };
      });
  }

  get size(): number {
    return this.docs.size;
  }

  private async load(rel: string): Promise<Doc | undefined> {
    const abs = this.hq.resolve(rel);
    if ((await stat(abs)).size > MAX_BYTES) return undefined;
    const raw = await readFile(abs, "utf8");
    const project = rel.includes("/") ? rel.split("/")[0] : "";
    const name = rel.split("/").pop()!;

    if (name === "report.json") {
      const report = JSON.parse(raw) as TypedReport;
      return { id: rel, project, kind: "report", title: report.title, text: reportText(report) };
    }
    if (kindOf(name) === "html") {
      const title = raw.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || folderTitle(rel);
      return { id: rel, project, kind: "report", title: decode(title), text: htmlText(raw) };
    }
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return { id: rel, project, kind: "markdown", title: heading || name.replace(/\.md$/, ""), text: body };
  }
}

function newMini() {
  return new MiniSearch<Doc>({
    fields: ["title", "text", "id"],
    storeFields: [],
    tokenize: (s) => s.split(/[\s\-_/.,:;()[\]{}"'`|<>!?*#=+]+/).filter(Boolean),
  });
}

function indexable(rel: string): boolean {
  const name = rel.split("/").pop()!;
  if (name === "report.json") return true;
  if (name === "index.template.html") return false;
  const kind = kindOf(name);
  return kind === "markdown" || kind === "html";
}

function flatten(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.type === "dir" ? flatten(n.children ?? []) : [n.path]));
}

function folderTitle(rel: string): string {
  const parts = rel.split("/");
  return parts.length > 1 ? parts[parts.length - 2] : rel;
}

export function htmlText(html: string): string {
  return decode(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (m) => (/application\/json/i.test(m) ? jsonText(m) : " "))
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Embedded report data (`<script type="application/json">`) holds the page's words, so keep its strings. */
function jsonText(block: string): string {
  const strings = block.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
  return " " + strings.map((s) => s.slice(1, -1).replace(/\\n/g, " ").replace(/\\"/g, '"')).join(" ") + " ";
}

function reportText(report: TypedReport): string {
  if (!isTodo(report)) return JSON.stringify(report);
  return [
    report.summary ?? "",
    ...report.sections.flatMap((s) => [s.title, s.intro ?? "", ...s.items.flatMap((i) => [i.text, i.detail ?? "", i.waitingOn ?? ""])]),
  ].join("\n");
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function snippet(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, " ");
  const lower = flat.toLowerCase();
  const at = terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - 60);
  const out = flat.slice(start, start + 180).trim();
  return (start > 0 ? "…" : "") + out + (start + 180 < flat.length ? "…" : "");
}
