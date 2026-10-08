import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TodoReport } from "../shared/types.ts";
import { createApp } from "./app.ts";
import { Hq } from "./hq.ts";
import { Workspace } from "./workspace.ts";

const REPORT: TodoReport = {
  type: "todo",
  version: 1,
  title: "Acme to-do",
  sections: [
    {
      id: "review",
      title: "Review",
      items: [
        { id: "approve-plan", ask: "check", text: "Approve the **cart** plan" },
        { id: "tax-rule", ask: "text", text: "Which tax rule applies to gift cards?" },
        { id: "fyi", text: "The build is green." },
      ],
    },
  ],
};

let root: string;
let app: ReturnType<typeof createApp>;

const get = (url: string) => app.request(url, { headers: { host: "localhost:4321" } });
const getJson = async (url: string): Promise<any> => (await get(url)).json();
const put = (body: unknown, headers: Record<string, string> = {}) =>
  app.request("/api/answers", {
    method: "PUT",
    headers: { host: "localhost:4321", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "hq-ui-"));
  const report = path.join(root, "acme-shop/general/reports/2026-10-07-0900-todo");
  await mkdir(report, { recursive: true });
  await mkdir(path.join(root, "plate/log"), { recursive: true });
  await mkdir(path.join(root, ".git"), { recursive: true });
  await writeFile(path.join(report, "report.json"), JSON.stringify(REPORT));
  await writeFile(path.join(report, "index.html"), "<html><title>Acme to-do</title><body>static</body></html>");
  await writeFile(path.join(root, "acme-shop/project.md"), "---\nproject: acme-shop\n---\n\n# Acme shop\n\nThe storefront runs on gizmos.\n");
  await writeFile(path.join(root, "plate/plate.md"), "# Plate\n\n## acme-shop\n\n- [ ] SHOP-004: build it (since 2026-10-01)\n");
  await writeFile(path.join(root, "plate/log/2026-10-08.md"), "# 2026-10-08\n\n## Done\n- shipped\n");
  await writeFile(path.join(root, ".git/config"), "secret");

  const ws = new Workspace(new Hq(root));
  await ws.load();
  app = createApp(ws, { today: () => "2026-10-08" });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("api", () => {
  it("refuses requests that don't come to a localhost name", async () => {
    const res = await app.request("/api/tree", { headers: { host: "evil.example" } });
    expect(res.status).toBe(403);
  });

  it("refuses paths outside headquarters and hidden folders", async () => {
    expect((await get("/api/entry?path=../outside")).status).toBe(400);
    expect((await get("/api/entry?path=.git/config")).status).toBe(400);
    expect((await get("/raw/..%2F..%2Fwindows")).status).toBe(400);
  });

  it("lists the tree without hidden folders and marks report folders", async () => {
    const tree = await getJson("/api/tree");
    expect(tree.map((n: { name: string }) => n.name)).toEqual(["acme-shop", "plate"]);
    const reports = tree[0].children[0].children[0].children;
    expect(reports[0]).toMatchObject({ name: "2026-10-07-0900-todo", report: true });
  });

  it("finds Markdown and reports by their words", async () => {
    const hits = await getJson("/api/search?q=gizmos");
    expect(hits[0]).toMatchObject({ path: "acme-shop/project.md", title: "Acme shop", project: "acme-shop" });
    const reportHits = await getJson("/api/search?q=gift%20cards");
    expect(reportHits[0].path).toBe("acme-shop/general/reports/2026-10-07-0900-todo/report.json");
  });

  it("returns the plate with today's log", async () => {
    const plate = await getJson("/api/plate");
    expect(plate.groups[0].items[0]).toMatchObject({ stories: ["SHOP-004"], text: "build it" });
    expect(plate.today.date).toBe("2026-10-08");
  });

  it("saves answers next to the report and clears them from the inbox", async () => {
    const dir = "acme-shop/general/reports/2026-10-07-0900-todo";
    let inbox = await getJson("/api/inbox");
    expect(inbox[0]).toMatchObject({ answered: 0, total: 2 });

    expect((await put({ path: dir, id: "approve-plan", answer: { done: true } })).status).toBe(200);
    expect((await put({ path: dir, id: "tax-rule", answer: { text: "Exempt, per Dana" } })).status).toBe(200);

    const saved = JSON.parse(await readFile(path.join(root, dir, "answers.json"), "utf8"));
    expect(saved.answers["approve-plan"].done).toBe(true);
    expect(saved.answers["tax-rule"].text).toBe("Exempt, per Dana");
    expect(saved.answers["tax-rule"].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    inbox = await getJson("/api/inbox");
    expect(inbox[0]).toMatchObject({ answered: 2, total: 2, open: [] });
  });

  it("removes an answer when it is cleared", async () => {
    const dir = "acme-shop/general/reports/2026-10-07-0900-todo";
    await put({ path: dir, id: "approve-plan", answer: { done: false } });
    const saved = JSON.parse(await readFile(path.join(root, dir, "answers.json"), "utf8"));
    expect(saved.answers["approve-plan"]).toBeUndefined();
  });

  it("rejects answers to unknown questions and cross-origin writes", async () => {
    const dir = "acme-shop/general/reports/2026-10-07-0900-todo";
    expect((await put({ path: dir, id: "fyi", answer: { done: true } })).status).toBe(400);
    expect((await put({ path: dir, id: "approve-plan", answer: { done: true } }, { origin: "http://evil.example" })).status).toBe(403);
  });

  it("serves raw report files", async () => {
    const res = await get("/raw/acme-shop/general/reports/2026-10-07-0900-todo/");
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("static");
  });
});
