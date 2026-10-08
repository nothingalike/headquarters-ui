import type { Answer, ReportItem, TodoReport, TypedReport } from "./types.ts";

export function isTodo(report: TypedReport): report is TodoReport {
  return report.type === "todo" && Array.isArray((report as TodoReport).sections);
}

/** Items that ask the user something, in page order. */
export function askedItems(report: TodoReport): { item: ReportItem; section: string }[] {
  return report.sections.flatMap((s) =>
    s.items.filter((i) => i.ask).map((item) => ({ item, section: s.title })),
  );
}

export function isAnswered(item: ReportItem, answer: Answer | undefined): boolean {
  if (!answer) return false;
  switch (item.ask) {
    case "check":
      return answer.done === true;
    case "text":
      return Boolean(answer.text?.trim());
    case "choice":
      return Boolean(answer.choice);
    default:
      return false;
  }
}
