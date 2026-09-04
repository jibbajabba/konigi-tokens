import type { Meta, StoryObj } from "@storybook/react-vite";
import tokensSrc from "../tokens.css?raw";
import { block, declarations } from "../scripts/parse.mjs";

/**
 * The catalog reads tokens.css itself rather than listing tokens by hand.
 * A hand-written list is a second source of truth and would start lying the
 * first time someone adds a token without remembering this file exists.
 */

interface Token {
  name: string;
  /** null when the token is only declared in the dark block. */
  light: string | null;
  dark: string;
}
interface Section {
  title: string;
  tokens: Token[];
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

  // The walk above is driven by the light block, so a token declared only in
  // dark was invisible here — five of them were, which is precisely the drift
  // this catalog exists to make impossible. Sweep up whatever light never
  // mentioned rather than trusting one block to list them all.
  const seen = new Set(sections.flatMap((s) => s.tokens.map((t) => t.name)));
  const darkOnly = [...dark]
    .filter(([name]) => !seen.has(name))
    .map(([name, value]) => ({ name, light: null, dark: value }));
  if (darkOnly.length) sections.push({ title: "Dark only", tokens: darkOnly });

  return sections;
}

type Kind = "shadow" | "radius" | "color";

function kindOf(t: Token): Kind {
  if (t.name.includes("shadow")) return "shadow";
  if (t.name.includes("radius")) return "radius";
  return "color";
}

function Swatch({ token, theme }: { token: Token; theme: "light" | "dark" }) {
  const kind = kindOf(token);
  const base: React.CSSProperties = {
    width: 96,
    height: 40,
    flexShrink: 0,
    borderRadius: 8,
    background: "var(--panel)",
  };
  // Nothing to draw. Falling through would paint an empty var() as
  // transparent, which is indistinguishable from --control-border.
  if (theme === "light" && token.light === null) {
    return <div style={{ ...base, background: "none", border: "1px dashed var(--border)" }} />;
  }
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
          <Swatch token={token} theme={theme} />
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
              {theme === "light" ? (token.light ?? "not set in light") : token.dark}
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
