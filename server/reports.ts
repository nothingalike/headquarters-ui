import { readFile, rename, writeFile } from "node:fs/promises";
import { askedItems, isAnswered, isTodo } from "../shared/reports.ts";
import type { Answer, AnswersFile, InboxReport, ReportBundle, TreeNode, TypedReport } from "../shared/types.ts";
import type { Hq } from "./hq.ts";

export const REPORT_FILE = "report.json";
export const ANSWERS_FILE = "answers.json";

export async function readReport(hq: Hq, dir: string): Promise<ReportBundle> {
  const report = JSON.parse(await readFile(hq.resolve(`${dir}/${REPORT_FILE}`), "utf8")) as TypedReport;
  return { path: dir, report, answers: await readAnswers(hq, dir), hasHtml: await hq.exists(`${dir}/index.html`) };
}

export async function readAnswers(hq: Hq, dir: string): Promise<AnswersFile> {
  try {
    const parsed = JSON.parse(await readFile(hq.resolve(`${dir}/${ANSWERS_FILE}`), "utf8")) as AnswersFile;
    return { version: 1, answers: parsed.answers ?? {} };
  } catch {
    return { version: 1, answers: {} };
  }
}

export type AnswerInput = Omit<Answer, "at">;

/**
 * Records one answer in the report's `answers.json`. An empty answer removes the
 * entry. Writes go through a temp file so an agent never reads half a file.
 */
export async function saveAnswer(hq: Hq, dir: string, id: string, input: AnswerInput): Promise<AnswersFile> {
  const { report } = await readReport(hq, dir);
  if (!isTodo(report) || !askedItems(report).some(({ item }) => item.id === id)) {
    throw new AnswerError(`No question with id "${id}" in ${dir}/${REPORT_FILE}`);
  }

  const file = await readAnswers(hq, dir);
  const answer: Answer = { at: new Date().toISOString() };
  if (input.done !== undefined) answer.done = input.done;
  if (input.text?.trim()) answer.text = input.text;
  if (input.choice) answer.choice = input.choice;

  if (answer.done || answer.text || answer.choice) file.answers[id] = answer;
  else delete file.answers[id];

  const target = hq.resolve(`${dir}/${ANSWERS_FILE}`);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(file, null, 2) + "\n", "utf8");
  await rename(temp, target);
  return file;
}

export class AnswerError extends Error {}

/** Every typed report with its unanswered questions, newest first. */
export async function inbox(hq: Hq, tree: TreeNode[]): Promise<InboxReport[]> {
  const dirs = reportDirs(tree);
  const reports = await Promise.all(
    dirs.map(async (dir): Promise<InboxReport | undefined> => {
      try {
        const { report, answers } = await readReport(hq, dir);
        if (!isTodo(report)) return undefined;
        const asked = askedItems(report);
        const open = asked
          .filter(({ item }) => !isAnswered(item, answers.answers[item.id]))
          .map(({ item, section }) => ({ id: item.id, text: item.text, ask: item.ask!, section }));
        return { path: dir, title: report.title, type: report.type, created: report.created, open, answered: asked.length - open.length, total: asked.length };
      } catch {
        return undefined;
      }
    }),
  );
  return reports
    .filter((r): r is InboxReport => Boolean(r))
    .sort((a, b) => b.path.split("/").pop()!.localeCompare(a.path.split("/").pop()!));
}

function reportDirs(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => {
    if (n.type !== "dir") return [];
    const own = n.children?.some((c) => c.name === REPORT_FILE) ? [n.path] : [];
    return [...own, ...reportDirs(n.children ?? [])];
  });
}
