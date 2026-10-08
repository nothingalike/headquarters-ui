import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import { rawUrl, resolveRelative, route } from "../paths.ts";

type Props = {
  children: string;
  /** Folder the Markdown lives in, for resolving relative links and images. */
  base?: string;
  /** Render without paragraph wrappers, for one-line text such as plate items. */
  inline?: boolean;
};

export function Markdown({ children, base = "", inline = false }: Props) {
  const components: Components = {
    a: ({ href = "", children }) => <SmartLink href={href} base={base}>{children}</SmartLink>,
    img: ({ src = "", alt }) => <img src={typeof src === "string" && !/^[a-z]+:/i.test(src) ? rawUrl(resolveRelative(base, src) ?? src) : String(src)} alt={alt ?? ""} />,
    table: ({ children }) => (
      <div className="scroll-x">
        <table>{children}</table>
      </div>
    ),
    ...(inline ? { p: ({ children }) => <>{children}</> } : {}),
  };
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

export function SmartLink({ href, base, children }: { href: string; base: string; children: React.ReactNode }) {
  if (/^(https?|mailto):/i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("#")) return <a href={href}>{children}</a>;

  const [target, hash = ""] = href.split("#");
  const resolved = resolveRelative(base, target);
  if (resolved === undefined) return <span title={`Outside headquarters: ${href}`}>{children}</span>;
  return <Link to={route(resolved) + (hash ? `#${hash}` : "")}>{children}</Link>;
}

/** Splits simple YAML front matter (`key: value` lines) from the body. */
export function frontMatter(source: string): { meta: [string, string][]; body: string } {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: [], body: source };
  const meta = m[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^([\w-]+):\s*(.*)$/))
    .filter((x): x is RegExpMatchArray => Boolean(x))
    .map((x) => [x[1], x[2]] as [string, string]);
  return { meta, body: source.slice(m[0].length) };
}
