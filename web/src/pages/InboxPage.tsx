import { Link } from "react-router";
import type { InboxReport } from "../../../shared/types.ts";
import { useApi } from "../api.ts";
import { Markdown } from "../components/Markdown.tsx";
import { route, splitDated } from "../paths.ts";

export function InboxPage() {
  const { data } = useApi<InboxReport[]>("/api/inbox");
  if (!data) return <div className="loading">Loading the inbox…</div>;

  const waiting = data.filter((r) => r.open.length > 0);
  const done = data.filter((r) => r.open.length === 0);
  const asks = waiting.reduce((n, r) => n + r.open.length, 0);

  return (
    <div className="inbox-page">
      <header className="page-head">
        <div className="kicker">Inbox</div>
        <h1>{asks === 0 ? "Nothing waits on you" : `${asks} ${asks === 1 ? "item waits" : "items wait"} on you in ${waiting.length} ${waiting.length === 1 ? "report" : "reports"}`}</h1>
        <p className="lede">
          Questions and to-dos from interactive reports. Your answers save to <code>answers.json</code> beside each report, where agents read them.
        </p>
      </header>

      {data.length === 0 && (
        <p className="muted">
          No interactive reports yet. They appear once an agent writes a report with <code>report.json</code> (the <code>hq-ui-report</code> skill).
        </p>
      )}

      {waiting.map((r) => (
        <section key={r.path} className="inbox-report">
          <h2>
            <Link to={route(r.path)}>{r.title}</Link>
            <span className="count">{r.answered} of {r.total} answered</span>
          </h2>
          <div className="inbox-where mono">{r.path.split("/")[0]} · {splitDated(r.path.split("/").pop()!).date ?? ""}</div>
          <ul className="inbox-asks">
            {r.open.map((a) => (
              <li key={a.id}>
                <span className={`ask-kind ask-${a.ask}`}>{a.ask === "check" ? "To do" : a.ask === "choice" ? "Choose" : "Answer"}</span>
                <Link to={`${route(r.path)}#${encodeURIComponent(a.id)}`} className="inbox-ask-text">
                  <Markdown base={r.path} inline>{firstLine(a.text)}</Markdown>
                </Link>
                <span className="muted inbox-section">{a.section}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {done.length > 0 && (
        <section className="inbox-done">
          <h2>Fully answered</h2>
          <ul>
            {done.map((r) => (
              <li key={r.path}>
                <Link to={route(r.path)}>{r.title}</Link> <span className="muted">{r.total} answered</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function firstLine(text: string): string {
  // The line sits inside a link, so its own links become plain text.
  return text.split(/\n/)[0].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}
