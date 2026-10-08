import { type FSWatcher, watch } from "node:fs";
import type { TreeNode } from "../shared/types.ts";
import { type Hq, isHidden } from "./hq.ts";
import { SearchIndex } from "./search.ts";

type Listener = (paths: string[]) => void;

/**
 * The live view of headquarters: the folder tree and search index, kept current
 * by a file watcher that tells listeners which paths changed.
 */
export class Workspace {
  readonly hq: Hq;
  readonly search: SearchIndex;
  private treeCache: TreeNode[] = [];
  private listeners = new Set<Listener>();
  private watcher?: FSWatcher;
  private pending = new Set<string>();
  private timer?: NodeJS.Timeout;

  constructor(hq: Hq) {
    this.hq = hq;
    this.search = new SearchIndex(hq);
  }

  async load(): Promise<void> {
    this.treeCache = await this.hq.tree();
    await this.search.build(this.treeCache);
  }

  get tree(): TreeNode[] {
    return this.treeCache;
  }

  watch(): void {
    this.watcher = watch(this.hq.root, { recursive: true }, (_event, name) => {
      if (!name) return;
      const rel = name.toString().split(/[\\/]/);
      if (rel.some((part) => isHidden(part)) || rel.at(-1)?.endsWith(".tmp")) return;
      this.pending.add(rel.join("/"));
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.flush(), 150);
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    clearTimeout(this.timer);
    this.watcher?.close();
  }

  private async flush(): Promise<void> {
    const paths = [...this.pending];
    this.pending.clear();
    try {
      this.treeCache = await this.hq.tree();
      await Promise.all(paths.map((p) => this.search.update(p)));
    } catch (err) {
      console.error("headquarters-ui: refresh failed", err);
    }
    for (const listener of this.listeners) listener(paths);
  }
}
