import { useState } from "react";
import { Link, useLocation } from "react-router";
import type { DirEntry, Entry, FileEntry, ReportBundle, TreeNode } from "../../../shared/types.ts";
import { useApi, q } from "../api.ts";
import { Markdown, frontMatter } from "../components/Markdown.tsx";
import { basename, dirname, formatDate, rawUrl, route, splitDated } from "../paths.ts";
import { HtmlFrame } from "../reports/HtmlFrame.tsx";
import { REPORT_VIEWS } from "../reports/registry.tsx";
import { Empty } from "./PlatePage.tsx";

/** Files shown above a folder's listing, in order of preference. */
const FOLDER_DOCS = ["project.md", "notes.md", "index.md", "README.md", "plate.md"];

export function BrowsePage() {
  const location = useLocation();
  const path = decodeURIComponent(location.pathname.replace(/^\/f\/?/, "")).replace(/\/$/, "");
  const { data, error } = useApi<Entry>(`/api/entry?path=${q(path)}`);

  if (error) {
    return (
      <Empty title={error.status === 404 ? "Not in headquarters" : "Can't open this"}>
        <code>{path}</code> {error.status === 404 ? "doesn't exist. It may live only on another machine, or it was moved." : error.message}
      </Empty>
    );
  }
  if (!data) return <div className="loading">Loading…</div>;
  return data.type === "dir" ? <FolderView entry={data} /> : <FileView entry={data} />;
}

function FolderView({ entry }: { entry: DirEntry }) {
  if (entry.report) return <ReportView entry={entry} />;
  const doc = FOLDER_DOCS.map((name) => entry.children.find((c) => c.name === name)).find(Boolean);
  const name = basename(entry.path) || "Headquarters";

  return (
    <div className="folder-page">
      <header className="page-head">
        <Breadcrumbs path={entry.path} />
        <h1>{splitDated(name).title}</h1>
      </header>
      {doc && <FolderDoc path={doc.path} />}
      <Listing nodes={entry.children.filter((c) => c !== doc)} />
    </div>
  );
}

function FolderDoc({ path }: { path: string }) {
  const { data } = useApi<FileEntry>(`/api/entry?path=${q(path)}`);
  if (!data?.content) return null;
  const { meta, body } = frontMatter(data.content);
  return (
    <section className="folder-doc">
      <MetaRow meta={meta} />
      <div className="prose">
        <Markdown base={dirname(path)}>{body}</Markdown>
      </div>
      <div className="source-note">
        From <Link to={route(path)}><code>{basename(path)}</code></Link>
      </div>
    </section>
  );
}

function Listing({ nodes }: { nodes: TreeNode[] }) {
  if (!nodes.length) return <p className="muted">This folder is empty.</p>;
  const folders = nodes.filter((n) => n.type === "dir");
  const files = nodes.filter((n) => n.type === "file");
  return (
    <div className="listing">
      {[{ label: "Folders", items: folders }, { label: "Files", items: files }]
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.label}>
            <h2 className="listing-label">
              {g.label} <span className="count">{g.items.length}</span>
            </h2>
            <ul className="listing-items">
              {g.items.map((n) => {
                const { date, time, title } = splitDated(n.name);
                return (
                  <li key={n.path}>
                    <Link to={route(n.path)} className={`listing-link kind-${n.report ? "report" : n.type}`}>
                      <span className="listing-icon" aria-hidden />
                      <span className="listing-name">{date ? title : n.name}</span>
                      {n.report && <span className="pill">report</span>}
                      {n.type === "dir" && !n.report && <span className="muted">{n.children?.length ?? 0} {n.children?.length === 1 ? "item" : "items"}</span>}
                      {date && <span className="listing-date mono">{formatDate(date, true)}{time ? ` ${time.slice(0, 2)}:${time.slice(2)}` : ""}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

function ReportView({ entry }: { entry: DirEntry }) {
  const { typed, html } = entry.report!;
  const { data: bundle, error } = useApi<ReportBundle>(typed ? `/api/report?path=${q(entry.path)}` : null);
  const View = bundle ? REPORT_VIEWS[bundle.report.type] : undefined;
  const [mode, setMode] = useState<"app" | "page">("app");
  const showPage = !typed || !View || mode === "page";
  const title = bundle?.report.title ?? splitDated(basename(entry.path)).title;
  const others = entry.children.filter((c) => !["index.html", "report.json", "answers.json"].includes(c.name));

  return (
    <div className={`report-page ${showPage && html ? "framed" : ""}`}>
      <div className="report-bar">
        <Breadcrumbs path={entry.path} />
        <div className="report-actions">
          {typed && View && html && (
            <div className="segmented small" role="radiogroup" aria-label="View">
              <button role="radio" aria-checked={mode === "app"} className={mode === "app" ? "on" : ""} onClick={() => setMode("app")}>
                Interactive
              </button>
              <button role="radio" aria-checked={mode === "page"} className={mode === "page" ? "on" : ""} onClick={() => setMode("page")}>
                Static page
              </button>
            </div>
          )}
          {html && (
            <a className="button" href={rawUrl(`${entry.path}/index.html`)} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          )}
          {others.length > 0 && <FilesMenu nodes={others} />}
        </div>
      </div>
      {error && <p className="bad-text">Couldn't read report.json: {error.message}</p>}
      {typed && bundle && !View && !html && (
        <Empty title={title}>
          This report's type, <code>{bundle.report.type}</code>, has no view in this version of the app.
        </Empty>
      )}
      {showPage && html ? (
        <HtmlFrame path={`${entry.path}/index.html`} title={title} />
      ) : (
        bundle && View && <View bundle={bundle} />
      )}
    </div>
  );
}

function FilesMenu({ nodes }: { nodes: TreeNode[] }) {
  return (
    <details className="files-menu">
      <summary className="button">Files ({nodes.length})</summary>
      <ul>
        {nodes.map((n) => (
          <li key={n.path}>
            <Link to={route(n.path)}>{n.name}</Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FileView({ entry }: { entry: FileEntry }) {
  const name = basename(entry.path);
  const base = dirname(entry.path);
  if (entry.kind === "html") {
    return (
      <div className="report-page framed">
        <div className="report-bar">
          <Breadcrumbs path={entry.path} />
          <a className="button" href={rawUrl(entry.path)} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </div>
        <HtmlFrame path={entry.path} title={name} />
      </div>
    );
  }

  return (
    <div className="file-page">
      <header className="page-head">
        <Breadcrumbs path={entry.path} />
        <div className="file-meta muted">
          {formatBytes(entry.size)} · changed {formatDate(entry.modified, true)} · <a href={rawUrl(entry.path)} target="_blank" rel="noreferrer">raw</a>
        </div>
      </header>
      {entry.kind === "markdown" && entry.content !== undefined && <MarkdownFile source={entry.content} base={base} />}
      {entry.kind === "image" && <img className="file-image" src={rawUrl(entry.path)} alt={name} />}
      {(entry.kind === "json" || entry.kind === "text") &&
        (entry.content !== undefined ? (
          <pre className="code-block">
            <code>{entry.kind === "json" ? prettyJson(entry.content) : entry.content}</code>
          </pre>
        ) : (
          <p className="muted">This file is too large to show here.</p>
        ))}
      {entry.kind === "binary" && (
        <p className="muted">
          No preview for this kind of file. <a href={rawUrl(entry.path)}>Download it</a>.
        </p>
      )}
    </div>
  );
}

function MarkdownFile({ source, base }: { source: string; base: string }) {
  const { meta, body } = frontMatter(source);
  return (
    <article className="markdown-file">
      <MetaRow meta={meta} />
      <div className="prose">
        <Markdown base={base}>{body}</Markdown>
      </div>
    </article>
  );
}

function MetaRow({ meta }: { meta: [string, string][] }) {
  if (!meta.length) return null;
  return (
    <dl className="meta-row">
      {meta.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Breadcrumbs({ path }: { path: string }) {
  const parts = path ? path.split("/") : [];
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link to="/f">headquarters</Link>
      {parts.map((part, i) => {
        const to = parts.slice(0, i + 1).join("/");
        return (
          <span key={to}>
            <span className="sep" aria-hidden>/</span>
            {i === parts.length - 1 ? <span aria-current="page">{part}</span> : <Link to={route(to)}>{part}</Link>}
          </span>
        );
      })}
    </nav>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
