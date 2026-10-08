import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { Plate, PlateItem } from "../../../shared/types.ts";
import { useApi } from "../api.ts";
import { Markdown } from "../components/Markdown.tsx";
import { daysSince, formatDate, route } from "../paths.ts";
import { useTree } from "../tree.tsx";

type Filter = "all" | "doing" | "held" | "stale";

const FILTERS: { id: Filter; label: string; test: (i: PlateItem) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "doing", label: "In progress", test: (i) => i.status === "doing" },
  { id: "held", label: "Waiting or blocked", test: (i) => Boolean(i.waitingOn || i.blocked) },
  { id: "stale", label: "Older than a week", test: (i) => Boolean(i.since && daysSince(i.since) > 7) },
];

export function PlatePage() {
  const { data, error } = useApi<Plate>("/api/plate");
  const [filter, setFilter] = useState<Filter>("all");
  const [project, setProject] = useState<string>("");

  const all = useMemo(() => data?.groups.flatMap((g) => g.items) ?? [], [data]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.test).length])), [all]);

  if (error) return <Empty title="No plate yet">Headquarters has no <code>plate/plate.md</code>. The <code>plate</code> skill creates it.</Empty>;
  if (!data) return <div className="loading">Loading the plate…</div>;

  const test = FILTERS.find((f) => f.id === filter)!.test;
  const groups = data.groups
    .filter((g) => !project || g.project === project)
    .map((g) => ({ ...g, items: g.items.filter(test).sort((a, b) => Number(b.status === "doing") - Number(a.status === "doing")) }))
    .filter((g) => g.items.length);

  return (
    <div className="plate-page">
      <header className="page-head">
        <div className="kicker">Plate</div>
        <h1>{all.length} open items across {data.groups.length} projects</h1>
        <div className="stat-row">
          <Stat n={counts.doing} label="in progress" />
          <Stat n={counts.held} label="waiting or blocked" tone="warn" />
          <Stat n={counts.stale} label="older than a week" tone="muted" />
        </div>
      </header>

      <div className="plate-layout">
        <section className="plate-main" aria-label="Open items">
          <div className="toolbar">
            <div className="segmented" role="radiogroup" aria-label="Filter items">
              {FILTERS.map((f) => (
                <button key={f.id} role="radio" aria-checked={filter === f.id} className={filter === f.id ? "on" : ""} onClick={() => setFilter(f.id)}>
                  {f.label} <span className="count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
              <option value="">All projects</option>
              {data.groups.map((g) => (
                <option key={g.project} value={g.project}>
                  {g.project} ({g.items.length})
                </option>
              ))}
            </select>
          </div>

          {groups.length === 0 && <p className="muted">No items match this filter.</p>}
          {groups.map((g) => (
            <section key={g.project} className="plate-group">
              <h2>
                <ProjectLink project={g.project} />
                <span className="count">{g.items.length}</span>
              </h2>
              <ul className="plate-items">
                {g.items.map((item) => (
                  <PlateRow key={item.line} item={item} />
                ))}
              </ul>
            </section>
          ))}
          <p className="source-note">
            Read from <Link to={route(data.path)}><code>{data.path}</code></Link>. Agents update it through the <code>plate</code> skill.
          </p>
        </section>

        <aside className="plate-side" aria-label="Today">
          {data.today ? (
            <>
              <div className="side-head">
                <h2>Today</h2>
                <Link to={route(data.today.path)} className="muted">{formatDate(data.today.date, true)}</Link>
              </div>
              <div className="prose compact">
                <Markdown base="plate/log">{data.today.content.replace(/^#\s+.*\n/, "")}</Markdown>
              </div>
            </>
          ) : (
            <>
              <h2>Today</h2>
              <p className="muted">Nothing logged yet today.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function PlateRow({ item }: { item: PlateItem }) {
  const { stories } = useTree();
  const age = item.since ? daysSince(item.since) : undefined;
  return (
    <li className={`plate-item status-${item.status}`}>
      <span className="status-mark" title={item.status === "doing" ? "In progress" : "Open"} aria-label={item.status === "doing" ? "In progress" : "Open"} />
      <div className="plate-body">
        <div className="plate-text">
          {item.stories.map((id) => {
            const path = stories.get(id.toUpperCase());
            return path ? (
              <Link key={id} to={route(path)} className="story-chip">{id}</Link>
            ) : (
              <span key={id} className="story-chip plain">{id}</span>
            );
          })}
          <Markdown base="plate" inline>{item.text}</Markdown>
        </div>
        <div className="plate-meta">
          {item.blocked && <span className="pill bad">Blocked: {item.blocked}</span>}
          {item.waitingOn && <span className="pill warn">Waiting on {item.waitingOn}</span>}
          {age !== undefined && (
            <span className={`age ${age > 7 ? "stale" : ""}`} title={`Since ${item.since}`}>
              {age === 0 ? "today" : `${age}d`}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function ProjectLink({ project }: { project: string }) {
  const { byPath } = useTree();
  return byPath.has(project) ? <Link to={route(project)}>{project}</Link> : <span>{project}</span>;
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "warn" | "muted" }) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <span className="stat-n">{n}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
