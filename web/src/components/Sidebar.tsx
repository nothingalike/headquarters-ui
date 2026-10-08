import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import type { InboxReport, TreeNode } from "../../../shared/types.ts";
import { useApi } from "../api.ts";
import { useLive } from "../live.tsx";
import { route, splitDated } from "../paths.ts";
import { useTree } from "../tree.tsx";

const OPEN_KEY = "hq-ui:open-folders";

function loadOpen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { tree } = useTree();
  const { connected } = useLive();
  const { data: inbox } = useApi<InboxReport[]>("/api/inbox");
  const openAsks = inbox?.reduce((n, r) => n + r.open.length, 0) ?? 0;
  const location = useLocation();
  const current = decodeURIComponent(location.pathname.replace(/^\/f\/?/, ""));
  const [open, setOpen] = useState(loadOpen);

  // Open every folder above the page being viewed.
  useEffect(() => {
    if (!location.pathname.startsWith("/f/")) return;
    const parts = current.split("/");
    setOpen((prev) => {
      const next = new Set(prev);
      for (let i = 1; i < parts.length; i++) next.add(parts.slice(0, i).join("/"));
      return next.size === prev.size ? prev : next;
    });
  }, [current, location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
    } catch {
      /* storage is a convenience */
    }
  }, [open]);

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <nav className="sidebar" aria-label="Headquarters">
      <Link to="/" className="brand" onClick={onNavigate}>
        <span className="brand-mark" aria-hidden>H</span>
        <span>Headquarters</span>
        <span className={`live-dot ${connected ? "on" : ""}`} title={connected ? "Watching for changes" : "Not connected to the server"} />
      </Link>

      <div className="nav-primary">
        <NavLink to="/" end className="nav-item" onClick={onNavigate}>
          Plate
        </NavLink>
        <NavLink to="/inbox" className="nav-item" onClick={onNavigate}>
          Inbox
          {openAsks > 0 && <span className="badge">{openAsks}</span>}
        </NavLink>
      </div>

      <div className="tree-label">Files</div>
      <ul className="tree" role="tree">
        {tree.map((node) => (
          <TreeRow key={node.path} node={node} depth={0} open={open} toggle={toggle} current={current} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}

type RowProps = {
  node: TreeNode;
  depth: number;
  open: Set<string>;
  toggle: (path: string) => void;
  current: string;
  onNavigate: () => void;
};

function TreeRow({ node, depth, open, toggle, current, onNavigate }: RowProps) {
  const isOpen = open.has(node.path);
  const active = current === node.path;
  const { date, time, title } = splitDated(node.name);
  // A report folder opens as a page; its files stay reachable from that page.
  const expandable = node.type === "dir" && !node.report && (node.children?.length ?? 0) > 0;

  return (
    <li role="treeitem" aria-expanded={expandable ? isOpen : undefined} aria-selected={active}>
      <div className={`tree-row ${active ? "active" : ""}`} style={{ paddingInlineStart: 8 + depth * 14 }}>
        {expandable ? (
          <button className="twisty" onClick={() => toggle(node.path)} aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}>
            <svg viewBox="0 0 10 10" className={isOpen ? "open" : ""} aria-hidden>
              <path d="M3 1.5 7 5 3 8.5" />
            </svg>
          </button>
        ) : (
          <span className="twisty-space" />
        )}
        <Link
          to={route(node.path)}
          className={`tree-link kind-${node.report ? "report" : node.type}`}
          onClick={() => {
            if (expandable && !isOpen) toggle(node.path);
            onNavigate();
          }}
          title={node.path}
        >
          {node.report && <span className="report-glyph" aria-label="report" />}
          <span className="tree-name">{date ? title : node.name}</span>
          {date && <span className="tree-date">{date.slice(5)}{time ? ` ${time}` : ""}</span>}
        </Link>
      </div>
      {expandable && isOpen && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeRow key={child.path} node={child} depth={depth + 1} open={open} toggle={toggle} current={current} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}
