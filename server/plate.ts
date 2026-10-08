import type { PlateGroup, PlateItem } from "../shared/types.ts";

const ITEM = /^\s*- \[( |\/)\]\s+(.*)$/;
const SINCE = /\s*\(since (\d{4}-\d{2}-\d{2})\)\s*$/;
// `— waiting on:` and `— blocked:` run to the end of the line (before `since`).
const HOLD = /\s+[—–-]{1,2}\s+(waiting on|blocked):\s*(.*)$/i;
const STORIES = /^((?:[A-Z][A-Z0-9]*-\d+)(?:\/(?:[A-Z][A-Z0-9]*-)?\d+)*)\s*:\s*/;

/**
 * Parses `plate/plate.md`: `## <project>` headings over `- [ ]` (open) and
 * `- [/]` (in progress) items, each ending in `(since YYYY-MM-DD)`.
 */
export function parsePlate(markdown: string): PlateGroup[] {
  const groups: PlateGroup[] = [];
  let current: PlateGroup | undefined;

  markdown.split(/\r?\n/).forEach((raw, index) => {
    const heading = raw.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = { project: heading[1], items: [] };
      groups.push(current);
      return;
    }
    const m = raw.match(ITEM);
    if (!m) return;
    if (!current) {
      current = { project: "general", items: [] };
      groups.push(current);
    }
    current.items.push(parseItem(m[1] === "/" ? "doing" : "open", m[2], index + 1));
  });

  return groups.filter((g) => g.items.length > 0);
}

function parseItem(status: PlateItem["status"], body: string, line: number): PlateItem {
  const item: PlateItem = { status, text: body, stories: [], line };

  const since = item.text.match(SINCE);
  if (since) {
    item.since = since[1];
    item.text = item.text.slice(0, since.index);
  }

  const hold = item.text.match(HOLD);
  if (hold) {
    const reason = hold[2].trim();
    if (hold[1].toLowerCase() === "blocked") item.blocked = reason;
    else item.waitingOn = reason;
    item.text = item.text.slice(0, hold.index);
  }

  const stories = item.text.match(STORIES);
  if (stories) {
    item.stories = expandStories(stories[1]);
    item.text = item.text.slice(stories[0].length);
  }

  item.text = item.text.trim();
  return item;
}

/** `FCTS-031/035` names FCTS-031 and FCTS-035. */
function expandStories(spec: string): string[] {
  const [first, ...rest] = spec.split("/");
  const prefix = first.replace(/\d+$/, "");
  return [first, ...rest.map((r) => (/^\d+$/.test(r) ? prefix + r : r))];
}
