#!/usr/bin/env node
// Checks a report folder's report.json and writes the static index.html beside it.
// Usage: node render.mjs <report folder>

import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TYPES = { todo: checkTodo };
const ASKS = ["check", "text", "choice"];

const dir = process.argv[2];
if (!dir) fail("Usage: node render.mjs <report folder>");

const reportPath = path.join(dir, "report.json");
let report;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (err) {
  fail(`Can't read ${reportPath}: ${err.message}`);
}

const check = TYPES[report.type];
if (!check) fail(`Unknown report type "${report.type}". Known types: ${Object.keys(TYPES).join(", ")}.`);
const problems = check(report);
if (problems.length) fail(`report.json has problems:\n- ${problems.join("\n- ")}`);

const here = path.dirname(fileURLToPath(import.meta.url));
const template = readFileSync(path.join(here, "template.html"), "utf8");
const embed = (value) => JSON.stringify(value, null, 2).replace(/<\//g, "<\\/");

const html = template
  .replace(/(<script type="application\/json" id="report-data">)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}\n${embed(report)}\n${close}`)
  .replace(/(<script type="application\/json" id="app-link">)[\s\S]*?(<\/script>)/, (_, open, close) => `${open}${embed(appLink(dir))}${close}`)
  .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(report.title)}</title>`);

writeFileSync(path.join(dir, "index.html"), html, "utf8");
const asked = report.sections.flatMap((s) => s.items).filter((i) => i.ask).length;
console.log(`Wrote ${path.join(dir, "index.html")} (${report.sections.length} sections, ${asked} asks).`);

function checkTodo(r) {
  const out = [];
  if (r.version !== 1) out.push('"version" must be 1');
  if (!r.title) out.push('"title" is required');
  if (!Array.isArray(r.sections) || !r.sections.length) return [...out, '"sections" must be a non-empty array'];
  const ids = new Set();
  const unique = (id, where) => {
    if (!id || typeof id !== "string") out.push(`${where} needs a string "id"`);
    else if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) out.push(`${where}: id "${id}" must be lowercase letters, digits, and hyphens`);
    else if (ids.has(id)) out.push(`${where}: id "${id}" is used twice`);
    else ids.add(id);
  };
  r.sections.forEach((s, si) => {
    const where = `sections[${si}]`;
    unique(s.id, where);
    if (!s.title) out.push(`${where} needs a "title"`);
    if (!Array.isArray(s.items)) return out.push(`${where} needs an "items" array`);
    s.items.forEach((it, ii) => {
      const at = `${where}.items[${ii}]`;
      unique(it.id, at);
      if (!it.text) out.push(`${at} needs "text"`);
      if (it.ask !== undefined && !ASKS.includes(it.ask)) out.push(`${at}: "ask" must be one of ${ASKS.join(", ")}`);
      if (it.ask === "choice" && !(Array.isArray(it.options) && it.options.length >= 2)) out.push(`${at}: a choice needs at least two "options"`);
    });
  });
  return out;
}

/** The page's address in Headquarters UI, when the folder sits inside headquarters. */
function appLink(folder) {
  const root = path.resolve(process.env.HQ_ROOT ?? path.join(os.homedir(), ".headquarters"));
  const rel = path.relative(root, path.resolve(folder));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return "";
  const port = process.env.HQ_UI_PORT ?? 4321;
  return `http://localhost:${port}/f/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
