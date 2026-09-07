import { useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The real controls, not look-alikes. These render the classes from
 * controls.css exactly as the apps use them — the file is imported in
 * .storybook/preview.ts alongside tokens.css, so what you see here is what
 * Unicron and Unigraph paint.
 *
 * That's the whole argument for stage B. A Storybook of demo components that
 * merely resemble the apps' is a museum: it can drift from the thing it
 * documents without anyone noticing, which is the same failure the token
 * catalog avoids by parsing tokens.css instead of listing tokens by hand.
 *
 * Hover them. Hover is a live CSS state, not a screenshot of one, and the
 * thing worth checking is that an unselected segment stays clearly lighter
 * than the sliding pill.
 */

const Icon = ({ d, size = 19 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
       stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const SIDEBAR = "M3 5h18M3 12h18M3 19h18";
const STAR = "M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8z";
const EYE = "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z";
const PENCIL = "M4 20h4L20 8l-4-4L4 16z";

/**
 * The sliding pill is positioned, not a background on the active button —
 * it sits before the buttons in the DOM so it can animate between them. Each
 * app owns that JS; this is the same measurement in miniature, so the story
 * shows a real indicator rather than a fake one drawn under the active tab.
 */
function Segmented({ className = "", items, initial = 0 }: {
  className?: string;
  items: React.ReactNode[];
  initial?: number;
}) {
  const [active, setActive] = useState(initial);
  const track = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const t = track.current, i = ind.current;
    if (!t || !i) return;
    const btn = t.querySelectorAll("button")[active] as HTMLElement | undefined;
    if (!btn) return;
    i.style.width = `${btn.offsetWidth}px`;
    i.style.transform = `translateX(${btn.offsetLeft - t.clientLeft}px)`;
    i.style.opacity = "1";
  }, [active, items.length]);

  return (
    <div className={`seg ${className}`.trim()} ref={track}>
      <span className="seg-indicator" ref={ind} />
      {items.map((node, n) => (
        <button key={n} className={n === active ? "active" : ""} onClick={() => setActive(n)}>
          {node}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
      <div style={{ width: 168, flexShrink: 0, fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <div
      data-theme={theme}
      style={{
        flex: "1 1 380px",
        background: "var(--bg)",
        color: "var(--text)",
        borderRadius: 12,
        padding: "8px 20px 20px",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: "var(--muted)", padding: "12px 0 4px" }}>
        {theme}
      </div>

      <Row label="Icon button">
        <button className="tb-btn"><Icon d={SIDEBAR} /></button>
        <button className="tb-btn"><Icon d={STAR} /></button>
        <button className="tb-btn active"><Icon d={SIDEBAR} /></button>
        <button className="tb-btn" disabled style={{ opacity: 0.4 }}><Icon d={STAR} /></button>
      </Row>

      <Row label="Segmented — text">
        <Segmented items={["Light", "Dark", "Auto"]} initial={1} />
      </Row>

      {/* .view-seg is each app's own: Unigraph's shares the toolbar row with
          .tb-btn and matches its 31px, Unicron's sits in the detail actions and
          doesn't. Only the base track is shared, so that's what's shown. */}
      <Row label="Segmented — icons">
        <Segmented items={[<Icon key="e" d={EYE} size={15} />, <Icon key="p" d={PENCIL} size={14} />]} />
      </Row>

      <Row label="Together">
        <button className="tb-btn"><Icon d={SIDEBAR} /></button>
        <button className="tb-btn active"><Icon d={STAR} /></button>
        <Segmented items={["One", "Two"]} />
      </Row>
    </div>
  );
}

function Controls() {
  return (
    <div style={{ font: "14px/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                  padding: 28, background: "var(--rail-bg)", minHeight: "100vh" }}
         data-theme="light">
      <h1 style={{ margin: "0 0 4px", fontSize: 20, color: "var(--text)" }}>Controls</h1>
      <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: 13, maxWidth: 640 }}>
        The classes from <code>controls.css</code>, rendered the way the apps use
        them — the same file Unicron and Unigraph import, not a copy. Hover
        them: an unselected segment has to stay clearly lighter than the sliding
        pill, and a hovered button reads the same weight as a selected one on
        purpose.
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Panel theme="light" />
        <Panel theme="dark" />
      </div>
    </div>
  );
}

const meta: Meta<typeof Controls> = { title: "Foundations/Controls", component: Controls };
export default meta;

export const AllControls: StoryObj<typeof Controls> = {};
