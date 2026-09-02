import type { Meta, StoryObj } from "@storybook/react-vite";
import tokensSrc from "../tokens.css?raw";

/**
 * The catalog reads tokens.css itself rather than listing tokens by hand.
 * A hand-written list is a second source of truth and would start lying the
 * first time someone adds a token without remembering this file exists.
 */

interface Token {
  name: string;
  light: string;
  dark: string;
}
interface Section {
  title: string;
  tokens: Token[];
}

/**
 * Comments blanked out but every index preserved, so a selector search can't
 * match prose. The file's own header documents `:root[data-theme="dark"]`, and
 * searching the raw text found that sentence instead of the rule — which
 * silently handed back the light block and printed light values under "dark".
 * Same length in, same length out, so offsets still point into the original.
 */
function mask(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
}

/** Pull one top-level block out of the stylesheet by its selector. */
function block(css: string, selector: string): string {
  const masked = mask(css);
  const at = masked.indexOf(selector);
  if (at === -1) return "";
  const open = masked.indexOf("{", at);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
}

/** Every `--name: value;` in a block, values allowed to wrap across lines. */
function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) out.set(m[1], m[2].split(/\s+/).join(" "));
  return out;
}

/**
 * Walk the light block in source order, using its own standalone comments as
 * section headings — the file is already organised, so the catalog inherits
 * that organisation instead of inventing one.
 */
function parse(css: string): Section[] {
  const light = block(css, ":root {");
  const dark = declarations(block(css, ':root[data-theme="dark"]'));
  const sections: Section[] = [];
  let current: Section = { title: "Surfaces", tokens: [] };

  const re = /\/\*([\s\S]*?)\*\/|(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(light))) {
    if (m[1] !== undefined) {
      const text = m[1].trim();
      // A comment sharing a line with the declaration before it is annotating
      // that token, not opening a section — `--sunken: #f0eee9; /* inset code
      // chips */` was becoming a heading of its own.
      const lineStart = light.lastIndexOf("\n", m.index) + 1;
      const trailing = light.slice(lineStart, m.index).trim().length > 0;
      // A short comment on its own is a heading; a long one is prose about the
      // token beneath it, which the catalog doesn't need to repeat.
      if (!trailing && text.length < 40 && !text.includes("\n")) {
        if (current.tokens.length) sections.push(current);
        current = { title: text.replace(/^\w/, (c) => c.toUpperCase()), tokens: [] };
      }
      continue;
    }
    const name = m[2];
    const value = m[3].split(/\s+/).join(" ");
    current.tokens.push({ name, light: value, dark: dark.get(name) ?? value });
  }
  if (current.tokens.length) sections.push(current);
  return sections;
}

type Kind = "shadow" | "radius" | "color";

function kindOf(t: Token): Kind {
  if (t.name.includes("shadow")) return "shadow";
  if (t.name.includes("radius")) return "radius";
  return "color";
}

function Swatch({ token }: { token: Token }) {
  const kind = kindOf(token);
  const base: React.CSSProperties = {
    width: 96,
    height: 40,
    flexShrink: 0,
    borderRadius: 8,
    background: "var(--panel)",
  };
  if (kind === "shadow") {
    return <div style={{ ...base, boxShadow: `var(${token.name})` }} />;
  }
  if (kind === "radius") {
    return (
      <div
        style={{
          ...base,
          borderRadius: `var(${token.name})`,
          background: "var(--selected-strong)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...base,
        // Checkerboard shows through anything translucent — several of these
        // are rgba overlays and a solid backing would hide that.
        backgroundImage:
          "linear-gradient(45deg, #bbb 25%, transparent 25%, transparent 75%, #bbb 75%)," +
          "linear-gradient(45deg, #bbb 25%, transparent 25%, transparent 75%, #bbb 75%)",
        backgroundSize: "12px 12px",
        backgroundPosition: "0 0, 6px 6px",
        backgroundColor: "#fff",
        border: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: `var(${token.name})` }} />
    </div>
  );
}

function Row({ token }: { token: Token }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        padding: "10px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 10,
            borderRadius: 10,
            background: "var(--bg)",
            color: "var(--text)",
          }}
        >
          <Swatch token={token} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}>
              {token.name}
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 11,
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {theme === "light" ? token.light : token.dark}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Catalog() {
  const sections = parse(tokensSrc);
  const count = sections.reduce((n, s) => n + s.tokens.length, 0);
  return (
    <div
      style={{
        font: "14px/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        padding: 28,
        background: "var(--rail-bg)",
        minHeight: "100vh",
      }}
      data-theme="light"
    >
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: "var(--text)" }}>
        Design tokens
      </h1>
      <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: 13 }}>
        {count} tokens, light and dark side by side. Read straight from{" "}
        <code>tokens.css</code> — the same file the apps import, so this page
        can&rsquo;t fall out of step with it.
      </p>
      {sections.map((s) => (
        <section key={s.title} style={{ marginBottom: 32 }}>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {s.title}
          </h2>
          {s.tokens.map((t) => (
            <Row key={t.name} token={t} />
          ))}
        </section>
      ))}
    </div>
  );
}

const meta: Meta<typeof Catalog> = {
  title: "Foundations/Tokens",
  component: Catalog,
};
export default meta;

export const AllTokens: StoryObj<typeof Catalog> = {};
