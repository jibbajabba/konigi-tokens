import type { Meta, StoryObj } from "@storybook/react-vite";
import tokensSrc from "../tokens.css?raw";
import invariants from "../invariants.json";
import { themes, valueIn, rgba } from "../scripts/parse.mjs";

/**
 * Rule 4, made visible. Every neutral fill in the system is one gray at a
 * different alpha, so the whole thing reduces to an ordering — and the bugs it
 * catches don't involve a single wrong token name. Two controls in the audit
 * hovered at 0.26 against a selected state of 0.14: pointing at an unselected
 * tab made it look more chosen than the chosen one, using entirely correct
 * tokens. Nothing but an ordering assertion catches that.
 *
 * This reads the same invariants.json that scripts/check.mjs reads, so the
 * picture and the linter can't disagree. If a strip below looks wrong, CI is
 * already failing — same numbers, two presentations.
 */

const t = themes(tokensSrc);
type Theme = "light" | "dark";

interface Step {
  name: string;
  value: string;
  alpha: number | null;
}

function steps(theme: Theme, chain: string[]): Step[] {
  return chain.map((name) => {
    const value = valueIn(t, theme, name) ?? "not declared";
    return { name, value, alpha: rgba(value)?.alpha ?? null };
  });
}

const mono = "ui-monospace, Menlo, monospace";

/**
 * One chain, drawn on the surface it actually paints on. The swatches sit on
 * --panel over --bg because that's where these fills land in the apps; showing
 * them on white would flatter the dark ones.
 */
function Strip({ theme, chain, why }: { theme: Theme; chain: string[]; why: string }) {
  const items = steps(theme, chain);
  // The assertion this strip is a picture of. Recomputed rather than trusted,
  // so a broken ladder shows up here as a marked swatch and not just as red CI.
  const breaks = items.map((s, i) =>
    i > 0 && s.alpha !== null && items[i - 1].alpha !== null && !(items[i - 1].alpha! < s.alpha!)
  );

  return (
    <div
      data-theme={theme}
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        padding: 20,
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
        {theme}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)", maxWidth: 620, lineHeight: 1.5 }}>
        {why}
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        {items.map((s, i) => (
          <div key={s.name} style={{ minWidth: 132 }}>
            {/* The fill over --panel: exactly how a control paints it. */}
            <div
              style={{
                height: 56,
                borderRadius: 10,
                background: "var(--panel)",
                position: "relative",
                overflow: "hidden",
                outline: breaks[i] ? "2px solid var(--danger)" : "1px solid var(--border)",
                outlineOffset: breaks[i] ? 2 : 0,
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: `var(${s.name})` }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, marginTop: 6 }}>{s.name}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: breaks[i] ? "var(--danger)" : "var(--muted)" }}>
              {s.alpha === null ? s.value : `α ${s.alpha}`}
              {breaks[i] ? " — out of order" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The deliberate equality. Two swatches that must be indistinguishable. */
function Equal({ theme, tokens, why }: { theme: Theme; tokens: string[]; why: string }) {
  const [a, b] = tokens;
  const va = valueIn(t, theme, a);
  const vb = valueIn(t, theme, b);
  const same = va === vb;
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", color: "var(--text)", padding: 20, borderRadius: 12, marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>
        {theme} — {a} === {b}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)", maxWidth: 620, lineHeight: 1.5 }}>{why}</p>
      <div style={{ display: "flex", gap: 10 }}>
        {[a, b].map((name) => (
          <div key={name} style={{ minWidth: 132 }}>
            <div
              style={{
                height: 56,
                borderRadius: 10,
                background: "var(--panel)",
                position: "relative",
                overflow: "hidden",
                outline: same ? "1px solid var(--border)" : "2px solid var(--danger)",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: `var(${name})` }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, marginTop: 6 }}>{name}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: same ? "var(--muted)" : "var(--danger)" }}>
              {valueIn(t, theme, name)}
            </div>
          </div>
        ))}
      </div>
      {!same && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--danger)" }}>
          These have drifted apart. check.mjs is failing on this too.
        </div>
      )}
    </div>
  );
}

function Ladders() {
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
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: "var(--text)" }}>Alpha ladders</h1>
      <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: 13, maxWidth: 620 }}>
        Read each strip left to right: every swatch has to sit heavier than the
        one before it. Read straight from <code>invariants.json</code> — the same
        assertions <code>scripts/check.mjs</code> enforces, so this page and CI
        can&rsquo;t tell different stories.
      </p>
      {invariants.ladders.map((l) => (
        <Strip key={`${l.theme}-${l.chain[0]}`} theme={l.theme as Theme} chain={l.chain} why={l.why} />
      ))}
      {invariants.equals.map((e) => (
        <Equal key={`${e.theme}-${e.tokens[0]}`} theme={e.theme as Theme} tokens={e.tokens} why={e.why} />
      ))}
    </div>
  );
}

const meta: Meta<typeof Ladders> = {
  title: "Foundations/Ladders",
  component: Ladders,
};
export default meta;

export const NeutralChains: StoryObj<typeof Ladders> = {};
