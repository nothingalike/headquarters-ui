import type { TreeNode } from "../../shared/types.ts";

/** App route for a headquarters path. A report's `index.html` opens as its folder. */
export function route(path: string): string {
  const clean = path.replace(/\/index\.html$/, "").replace(/\/$/, "");
  return clean ? `/f/${clean.split("/").map(encodeURIComponent).join("/")}` : "/f";
}

export const rawUrl = (path: string) => `/raw/${path.split("/").map(encodeURIComponent).join("/")}`;

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Resolves `href` against the folder `base`; returns undefined when it climbs out of headquarters. */
export function resolveRelative(base: string, href: string): string | undefined {
  const parts = base ? base.split("/") : [];
  for (const seg of href.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!parts.length) return undefined;
      parts.pop();
    } else parts.push(decodeURIComponent(seg));
  }
  return parts.join("/");
}

/** Splits a dated name like `2026-10-07-1809-kyle-todo` into its date and title. */
export function splitDated(name: string): { date?: string; time?: string; title: string } {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})(?:-(\d{4}))?-?(.*)$/);
  if (!m) return { title: name };
  return { date: m[1], time: m[2], title: (m[3] || m[1]).replace(/\.(md|html)$/, "").replace(/-/g, " ") };
}

export function prettyName(name: string): string {
  return splitDated(name).title.replace(/\.md$/, "");
}

export function formatDate(iso: string, withYear = false): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

export function daysSince(date: string, now = new Date()): number {
  const then = new Date(`${date}T00:00:00`);
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return formatDate(iso);
}

export function flattenTree(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children) flattenTree(n.children, out);
  }
  return out;
}
