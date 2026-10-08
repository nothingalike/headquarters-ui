import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import type { DirEntry, Entry, FileEntry, Plate } from "../shared/types.ts";
import { PathError, kindOf, mimeOf } from "./hq.ts";
import { parsePlate } from "./plate.ts";
import { AnswerError, type AnswerInput, inbox, readReport, saveAnswer } from "./reports.ts";
import type { Workspace } from "./workspace.ts";

const MAX_TEXT = 5_000_000;

export type AppOptions = {
  /** Built web app to serve; omitted in dev, where Vite serves it. */
  distDir?: string;
  /** Local date (`YYYY-MM-DD`) used to find today's log; defaults to now. */
  today?: () => string;
};

export function createApp(ws: Workspace, options: AppOptions = {}): Hono {
  const { hq } = ws;
  const today = options.today ?? localDate;
  const app = new Hono();

  // The server only answers to localhost names, so a web page elsewhere can't
  // reach it by rebinding its own domain to 127.0.0.1.
  app.use("*", async (c, next) => {
    const host = (c.req.header("host") ?? "").replace(/:\d+$/, "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) throw new HTTPException(403, { message: "Local requests only" });
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const origin = c.req.header("origin");
      if (origin && new URL(origin).host !== c.req.header("host")) throw new HTTPException(403, { message: "Cross-origin write refused" });
    }
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof PathError) return c.json({ error: err.message }, 400);
    if (err instanceof AnswerError) return c.json({ error: err.message }, 400);
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return c.json({ error: "Not found" }, 404);
    console.error(err);
    return c.json({ error: "Server error" }, 500);
  });

  app.get("/api/info", (c) => c.json({ root: hq.root, documents: ws.search.size }));

  app.get("/api/tree", (c) => c.json(ws.tree));

  app.get("/api/entry", async (c) => {
    const rel = c.req.query("path") ?? "";
    const abs = hq.resolve(rel);
    const info = await stat(abs);
    if (info.isDirectory()) {
      const children = await hq.tree(rel);
      const names = new Set(children.map((n) => n.name));
      const entry: DirEntry = { type: "dir", path: rel, children };
      if (names.has("report.json") || names.has("index.html")) {
        entry.report = { typed: names.has("report.json"), html: names.has("index.html") };
      }
      return c.json(entry satisfies Entry);
    }
    const kind = kindOf(abs);
    const entry: FileEntry = { type: "file", path: rel, kind, size: info.size, modified: info.mtime.toISOString() };
    if (kind !== "image" && kind !== "binary" && info.size <= MAX_TEXT) entry.content = await readFile(abs, "utf8");
    return c.json(entry satisfies Entry);
  });

  app.get("/api/search", (c) => c.json(ws.search.search(c.req.query("q") ?? "", Number(c.req.query("limit") ?? 30))));

  app.get("/api/plate", async (c) => {
    const plate: Plate = { path: "plate/plate.md", groups: [] };
    if (await hq.exists(plate.path)) plate.groups = parsePlate(await readFile(hq.resolve(plate.path), "utf8"));
    const date = c.req.query("date") ?? today();
    const logPath = `plate/log/${date}.md`;
    if (await hq.exists(logPath)) plate.today = { date, path: logPath, content: await readFile(hq.resolve(logPath), "utf8") };
    return c.json(plate);
  });

  app.get("/api/report", async (c) => c.json(await readReport(hq, c.req.query("path") ?? "")));

  app.put("/api/answers", async (c) => {
    const body = await c.req.json<{ path: string; id: string; answer: AnswerInput }>();
    if (!body?.path || !body.id || typeof body.answer !== "object") throw new HTTPException(400, { message: "Expected { path, id, answer }" });
    return c.json(await saveAnswer(hq, body.path, body.id, body.answer));
  });

  app.get("/api/inbox", async (c) => c.json(await inbox(hq, ws.tree)));

  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = ws.subscribe((paths) => void stream.writeSSE({ event: "change", data: JSON.stringify({ paths }) }));
      stream.onAbort(unsubscribe);
      while (!stream.aborted) {
        await stream.writeSSE({ event: "ping", data: "" });
        await stream.sleep(25_000);
      }
      unsubscribe();
    }),
  );

  // Raw files, for reports in frames, their assets, and images in Markdown.
  app.get("/raw/*", async (c) => {
    const rel = decodeURIComponent(c.req.path.slice("/raw/".length));
    let abs = hq.resolve(rel);
    if ((await stat(abs)).isDirectory()) abs = path.join(abs, "index.html");
    const info = await stat(abs);
    return new Response(Readable.toWeb(createReadStream(abs)) as ReadableStream, {
      headers: { "content-type": mimeOf(abs), "content-length": String(info.size), "cache-control": "no-cache" },
    });
  });

  if (options.distDir) {
    const root = path.relative(process.cwd(), options.distDir) || ".";
    app.use("/assets/*", serveStatic({ root }));
    app.get("*", serveStatic({ root, path: "index.html" }));
  }

  return app;
}

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
