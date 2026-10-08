#!/usr/bin/env node
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { Hq } from "./hq.ts";
import { Workspace } from "./workspace.ts";

const dev = process.argv.includes("--dev");
const root = process.env.HQ_ROOT ?? path.join(os.homedir(), ".headquarters");
const port = Number(process.env.HQ_UI_PORT ?? 4321);
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");

if (!existsSync(root)) {
  console.error(`headquarters-ui: no headquarters at ${root}. Set HQ_ROOT to point at it.`);
  process.exit(1);
}
if (!dev && !existsSync(path.join(distDir, "index.html"))) {
  console.error("headquarters-ui: the web app isn't built yet. Run `npm start`, or `npm run dev` while developing.");
  process.exit(1);
}

const ws = new Workspace(new Hq(root));
await ws.load();
ws.watch();

const app = createApp(ws, { distDir: dev ? undefined : distDir });
const server = serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, () => {
  const url = dev ? "http://localhost:5173" : `http://localhost:${port}`;
  console.log(`headquarters-ui: ${ws.search.size} documents from ${root}`);
  console.log(`headquarters-ui: open ${url}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    ws.close();
    server.close();
    process.exit(0);
  });
}
