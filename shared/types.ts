// Shapes shared by the server and the web app. Paths are always relative to the
// headquarters root and use forward slashes.

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  /** A folder that holds a report (`index.html` or `report.json`). */
  report?: boolean;
  children?: TreeNode[];
};

export type EntryKind = "markdown" | "html" | "json" | "image" | "text" | "binary";

export type DirEntry = {
  type: "dir";
  path: string;
  children: TreeNode[];
  /** Present when the folder is a report. */
  report?: { typed: boolean; html: boolean };
};

export type FileEntry = {
  type: "file";
  path: string;
  kind: EntryKind;
  size: number;
  modified: string;
  /** Text content for markdown, html, json, and text files. */
  content?: string;
};

export type Entry = DirEntry | FileEntry;

export type SearchHit = {
  path: string;
  title: string;
  kind: string;
  project: string;
  snippet: string;
  score: number;
};

// ---- Plate ----

export type PlateStatus = "open" | "doing";

export type PlateItem = {
  status: PlateStatus;
  /** The item text with the status box, `since`, and hold markers removed. */
  text: string;
  /** Story ids the item names at its start, such as `SHOP-004` or `FCTS-031/035`. */
  stories: string[];
  since?: string;
  waitingOn?: string;
  blocked?: string;
  line: number;
};

export type PlateGroup = { project: string; items: PlateItem[] };

export type DayLog = { date: string; path: string; content: string };

export type Plate = {
  path: string;
  groups: PlateGroup[];
  today?: DayLog;
};

// ---- Typed reports ----

export type AskKind = "check" | "text" | "choice";

export type ReportItem = {
  id: string;
  ask?: AskKind;
  /** Markdown. */
  text: string;
  /** Markdown shown under the item, such as steps or a draft to copy. */
  detail?: string;
  options?: string[];
  waitingOn?: string;
};

export type ReportSection = {
  id: string;
  title: string;
  intro?: string;
  items: ReportItem[];
};

export type TodoReport = {
  type: "todo";
  version: 1;
  title: string;
  summary?: string;
  created?: string;
  project?: string;
  story?: string;
  sections: ReportSection[];
};

/** Every typed report has at least a `type` and a `title`. */
export type TypedReport = TodoReport | { type: string; title: string; [key: string]: unknown };

export type Answer = {
  done?: boolean;
  text?: string;
  choice?: string;
  /** ISO timestamp of the last change. */
  at: string;
};

export type AnswersFile = { version: 1; answers: Record<string, Answer> };

export type ReportBundle = {
  path: string;
  report: TypedReport;
  answers: AnswersFile;
  hasHtml: boolean;
};

export type InboxReport = {
  path: string;
  title: string;
  type: string;
  created?: string;
  open: { id: string; text: string; ask: AskKind; section: string }[];
  answered: number;
  total: number;
};

export type ChangeEvent = { paths: string[] };
