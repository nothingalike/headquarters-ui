import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { TreeNode } from "../../shared/types.ts";
import { useApi } from "./api.ts";
import { flattenTree } from "./paths.ts";

type TreeState = {
  tree: TreeNode[];
  byPath: Map<string, TreeNode>;
  /** Story folders by id (`FCTS-031` → `fcts-v2/stories/FCTS-031`). */
  stories: Map<string, string>;
};

const TreeContext = createContext<TreeState>({ tree: [], byPath: new Map(), stories: new Map() });

export function TreeProvider({ children }: { children: ReactNode }) {
  const { data } = useApi<TreeNode[]>("/api/tree");
  const value = useMemo<TreeState>(() => {
    const tree = data ?? [];
    const all = flattenTree(tree);
    const byPath = new Map(all.map((n) => [n.path, n]));
    const stories = new Map(
      all.filter((n) => n.type === "dir" && /^[^/]+\/stories\/[^/]+$/.test(n.path)).map((n) => [n.name.toUpperCase(), n.path]),
    );
    return { tree, byPath, stories };
  }, [data]);
  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

export const useTree = () => useContext(TreeContext);
