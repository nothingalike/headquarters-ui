import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { SearchHit } from "../../../shared/types.ts";
import { api, q } from "../api.ts";
import { flattenTree, route, splitDated } from "../paths.ts";
import { useTree } from "../tree.tsx";

type Result = { key: string; path: string; title: string; detail: string; group: "Go to" | "Contents" };

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selected, setSelected] = useState(0);
  const { tree } = useTree();
  const navigate = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      api<SearchHit[]>(`/api/search?q=${q(term)}&limit=25`).then(setHits, () => setHits([]));
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // Names first (folders, stories, reports), then matches inside files.
  const results = useMemo<Result[]>(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    const words = term.split(/\s+/);
    const names = flattenTree(tree)
      .filter((n) => n.type === "dir" || !/\.(png|jpe?g|gif|webp)$/i.test(n.name))
      .filter((n) => words.every((w) => n.path.toLowerCase().includes(w)))
      .sort((a, b) => score(b.name, term) - score(a.name, term) || a.path.length - b.path.length)
      .slice(0, 6)
      .map<Result>((n) => ({ key: `n:${n.path}`, path: n.path, title: splitDated(n.name).title, detail: n.path, group: "Go to" }));
    const seen = new Set(names.map((n) => route(n.path)));
    const contents = hits
      .filter((h) => !seen.has(route(h.path.replace(/\/report\.json$/, ""))))
      .map<Result>((h) => ({ key: `c:${h.path}`, path: h.path.replace(/\/report\.json$/, ""), title: h.title, detail: h.snippet, group: "Contents" }));
    return [...names, ...contents];
  }, [query, hits, tree]);

  useEffect(() => setSelected(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    navigate(route(r.path));
    onClose();
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-label="Search headquarters" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="palette-input"
          placeholder="Search projects, stories, reports, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") go(results[selected]);
          }}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="palette-results"
          aria-activedescendant={results[selected] ? `palette-${selected}` : undefined}
        />
        <ul className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {results.map((r, i) => (
            <li key={r.key}>
              {(i === 0 || results[i - 1].group !== r.group) && <div className="palette-group">{r.group}</div>}
              <button
                id={`palette-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === selected}
                className={`palette-item ${i === selected ? "selected" : ""}`}
                onMouseMove={() => setSelected(i)}
                onClick={() => go(r)}
              >
                <span className="palette-title">{r.title}</span>
                <span className={`palette-detail ${r.group === "Go to" ? "mono" : ""}`}>{r.detail}</span>
              </button>
            </li>
          ))}
          {query.trim().length >= 2 && results.length === 0 && <li className="palette-empty">Nothing in headquarters matches “{query.trim()}”.</li>}
        </ul>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function score(name: string, term: string): number {
  const n = name.toLowerCase();
  if (n === term) return 3;
  if (n.startsWith(term)) return 2;
  return n.includes(term) ? 1 : 0;
}
