import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

type Live = {
  /** Increments every time headquarters changes on disk. */
  version: number;
  connected: boolean;
  lastPaths: string[];
};

const LiveContext = createContext<Live>({ version: 0, connected: false, lastPaths: [] });

export function LiveProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<Live>({ version: 0, connected: false, lastPaths: [] });

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => setLive((l) => ({ ...l, connected: true }));
    source.onerror = () => setLive((l) => ({ ...l, connected: false }));
    source.addEventListener("change", (e) => {
      const { paths } = JSON.parse((e as MessageEvent).data) as { paths: string[] };
      setLive((l) => ({ version: l.version + 1, connected: true, lastPaths: paths }));
    });
    return () => source.close();
  }, []);

  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
