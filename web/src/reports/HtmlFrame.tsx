import { useLive } from "../live.tsx";
import { rawUrl } from "../paths.ts";

/**
 * A static HTML report in a sandboxed frame. The frame gets scripts (reports
 * use them for tabs and copy buttons) but no access to the app's origin.
 */
export function HtmlFrame({ path, title }: { path: string; title: string }) {
  const { version, lastPaths } = useLive();
  // Reload only when this report's own folder changed.
  const dir = path.replace(/\/[^/]*$/, "");
  const touched = lastPaths.some((p) => p.startsWith(dir + "/") || p === path);
  const key = touched ? version : 0;

  return (
    <iframe
      key={key}
      className="report-frame"
      src={rawUrl(path)}
      title={title}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-top-navigation-by-user-activation"
      allow="clipboard-write"
    />
  );
}
