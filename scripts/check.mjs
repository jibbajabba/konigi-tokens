#!/usr/bin/env node
/**
 * Token checker for @konigi/tokens and the apps that consume it.
 *
 * Six rules. The first two are the obvious ones; the rest are here because the
 * obvious ones would have caught almost none of the bugs found in the audit.
 *
 *   1  no literal colors outside the token files          (needs --css)
 *   2  no var(--x) that nothing declares                  (needs --css)
 *   3  declared in both themes, or allowlisted
 *   4  the alpha ladders hold
 *   5  no `--token:` written inside a comment
 *   6  declared but never used                            (needs --css, warns)
 *
 * Usage
 *   node scripts/check.mjs --tokens tokens.css --invariants invariants.json
 *   node scripts/check.mjs --tokens shared.css,local.css --css src \
 *     --invariants shared/invariants.json,invariants.local.json
 *
 * --tokens and --invariants both take comma-separated lists in cascade order:
 * later files win, the same way the app's imports do. Exits non-zero on any error; warnings don't
 * fail the build.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { mask, block, declarations, rgba } from "./parse.mjs";

// ---------------------------------------------------------------- args

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const tokenFiles = (flag("--tokens") ?? "").split(",").filter(Boolean);
const invariantFiles = (flag("--invariants") ?? "").split(",").filter(Boolean);
const cssRoot = flag("--css");

if (!tokenFiles.length || !invariantFiles.length) {
  console.error("usage: check.mjs --tokens a.css[,b.css] --invariants a.json[,b.json] [--css src]");
  process.exit(2);
}

const errors = [];
const warnings = [];
const err = (rule, msg) => errors.push(`[rule ${rule}] ${msg}`);
const warn = (rule, msg) => warnings.push(`[rule ${rule}] ${msg}`);

// ---------------------------------------------------------------- parsing

const light = new Map();
const dark = new Map();

for (const file of tokenFiles) {
  const css = readFileSync(file, "utf8");

  // Rule 5 — a `--token:` inside a comment reads as a declaration to any regex
  // parser and swallows the next real one. This broke a verifier mid-audit.
  const commentRe = /\/\*[\s\S]*?\*\//g;
  let c;
  while ((c = commentRe.exec(css))) {
    const hit = /(--[\w-]+)\s*:\s*\S/.exec(c[0]);
    if (hit) {
      const line = css.slice(0, c.index + hit.index).split("\n").length;
      err(5, `${file}:${line} — \`${hit[1]}:\` written inside a comment. Drop the colon or the value.`);
    }
  }

  for (const [k, v] of declarations(block(css, ":root {"))) light.set(k, v);
  for (const [k, v] of declarations(block(css, ':root[data-theme="dark"]'))) dark.set(k, v);
}

const names = new Set([...light.keys(), ...dark.keys()]);
/** What a token actually resolves to under a theme, cascade included. */
const valueIn = (theme, name) =>
  theme === "dark" ? dark.get(name) ?? light.get(name) : light.get(name);

/**
 * Merged in order, same as --tokens. An app consuming this package points at
 * the shared invariants.json plus its own: the shared file can't know that
 * Unicron's --console-* are deliberately theme-invariant, and the app has no
 * business editing the shared one to say so.
 */
const inv = { ladders: [], equals: [], themeInvariant: { lightOnly: {}, darkOnly: {} } };
for (const file of invariantFiles) {
  const part = JSON.parse(readFileSync(file, "utf8"));
  inv.ladders.push(...(part.ladders ?? []));
  inv.equals.push(...(part.equals ?? []));
  Object.assign(inv.themeInvariant.lightOnly, part.themeInvariant?.lightOnly ?? {});
  Object.assign(inv.themeInvariant.darkOnly, part.themeInvariant?.darkOnly ?? {});
}
const lightOnly = new Set(Object.keys(inv.themeInvariant.lightOnly));
const darkOnly = new Set(Object.keys(inv.themeInvariant.darkOnly));

// ---------------------------------------------------------------- rule 3

for (const name of names) {
  const hasLight = light.has(name);
  const hasDark = dark.has(name);
  if (hasLight && !hasDark && !lightOnly.has(name)) {
    err(3, `${name} is declared in light but not dark, and isn't in themeInvariant.lightOnly. In dark it resolves to the light value — say so on purpose or give it one.`);
  }
  if (hasDark && !hasLight && !darkOnly.has(name)) {
    err(3, `${name} is declared in dark but not light, and isn't in themeInvariant.darkOnly. In light it resolves to nothing.`);
  }
}
for (const name of [...lightOnly, ...darkOnly]) {
  if (!names.has(name)) warn(3, `themeInvariant lists ${name}, which no longer exists. Drop it from invariants.json.`);
}

// ---------------------------------------------------------------- rule 4

for (const ladder of inv.ladders ?? []) {
  const { theme, chain } = ladder;
  const steps = [];
  let usable = true;
  for (const name of chain) {
    const parsed = rgba(valueIn(theme, name));
    if (!parsed) {
      err(4, `${theme}: ${name} is ${valueIn(theme, name) ?? "not declared"}, which isn't an rgba() and can't be ordered. Fix the token or the chain.`);
      usable = false;
      continue;
    }
    steps.push({ name, ...parsed });
  }
  if (!usable) continue;

  const bases = new Set(steps.map((s) => s.base));
  if (bases.size > 1) {
    err(4, `${theme}: this chain mixes rgb bases (${[...bases].join(" / ")}). Only same-base tokens are comparable — split it into one chain per family.`);
    continue;
  }
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const cur = steps[i];
    if (!(prev.alpha < cur.alpha)) {
      err(4, `${theme}: ${prev.name} (${prev.alpha}) must sit below ${cur.name} (${cur.alpha}). ` +
             `As it stands the lighter state paints at least as heavy as the heavier one, so a control lies about what's selected.`);
    }
  }
}

for (const eq of inv.equals ?? []) {
  const [a, b] = eq.tokens;
  const va = valueIn(eq.theme, a);
  const vb = valueIn(eq.theme, b);
  if (va !== vb) {
    err(4, `${eq.theme}: ${a} (${va}) and ${b} (${vb}) are meant to be identical. ${eq.why}`);
  }
}

// ---------------------------------------------------------------- rules 1, 2, 6

if (cssRoot) {
  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      if (statSync(p).isDirectory()) walk(p, out);
      else out.push(p);
    }
    return out;
  };
  const all = walk(cssRoot);
  const tokenSet = new Set(tokenFiles.map((f) => relative(".", f)));
  const cssFiles = all.filter((f) => extname(f) === ".css" && !tokenSet.has(relative(".", f)));
  const codeFiles = all.filter((f) => [".css", ".ts", ".tsx", ".js", ".jsx"].includes(extname(f)));

  /**
   * Strip what a var() can hide inside. Block comments everywhere; line
   * comments in the JS family only, since CSS has none and `https://` would
   * eat the rest of the line. Length is preserved so reported lines still line
   * up with the file.
   */
  const strip = (src, file) => {
    let out = mask(src);
    if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(file))) {
      out = out.replace(/(^|[^:\\])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
    }
    return out;
  };

  /**
   * Anything the app declares for itself counts as defined — these aren't
   * design tokens, they're component plumbing. Three spellings, because a
   * custom property can be set from CSS, from an inline style object where the
   * key is quoted, or from setProperty at runtime. Missing the last two is why
   * an early run of this cried wolf 26 times on --chip-color and --rail-w.
   */
  const declaredLocally = new Set();
  const used = new Set();
  // Seed with references the token files make to each other. --control-bg is
  // var(--tb-fill) in dark, and once the shared file lives in node_modules
  // instead of src that reference stops being visible from --css — which had
  // adopting the package spuriously report half the glass tokens as unused.
  for (const f of tokenFiles) {
    for (const m of mask(readFileSync(f, "utf8")).matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
  }
  for (const f of codeFiles) {
    const src = strip(readFileSync(f, "utf8"), f);
    for (const m of src.matchAll(/(--[\w-]+)\s*:/g)) declaredLocally.add(m[1]);
    for (const m of src.matchAll(/["'](--[\w-]+)["']\s*[:,]/g)) declaredLocally.add(m[1]);
    for (const m of src.matchAll(/setProperty\(\s*["'](--[\w-]+)["']/g)) declaredLocally.add(m[1]);
    for (const m of src.matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
  }

  // Rule 1 — literal colors. `tokens-allow` opts out, for the handful that
  // genuinely can't be a token: ::highlight() can't see custom properties, and
  // paper behind a light-authored diagram has to stay white in both themes.
  //
  // The marker counts on the line itself or anywhere in the comment block
  // directly above it. Most of these need a sentence of explanation and that
  // doesn't fit on the end of a declaration.
  const literal = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/;
  for (const f of cssFiles) {
    const raw = readFileSync(f, "utf8").split("\n");
    const lines = mask(readFileSync(f, "utf8")).split("\n");
    /** A line that's nothing but comment: blank once masked, not blank before. */
    const commentOnly = (i) => lines[i]?.trim() === "" && raw[i]?.trim() !== "";

    /**
     * Lines covered by a marker on a block-opening line, through to the
     * matching brace. `@media print { /* tokens-allow *\/` covers the whole
     * block — print is ink on paper, every value in there is deliberately
     * literal, and ten separate markers would be worse than the problem.
     */
    const blockAllowed = new Set();
    lines.forEach((line, i) => {
      if (!raw[i].includes("tokens-allow") || !line.trim().endsWith("{")) return;
      let depth = 0;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) ?? []).length;
        depth -= (lines[j].match(/\}/g) ?? []).length;
        blockAllowed.add(j);
        if (depth <= 0) break;
      }
    });

    const allowed = (i) => {
      if (raw[i].includes("tokens-allow") || blockAllowed.has(i)) return true;
      for (let j = i - 1; j >= 0 && commentOnly(j); j--) {
        if (raw[j].includes("tokens-allow")) return true;
      }
      return false;
    };
    lines.forEach((line, i) => {
      if (!literal.test(line)) return;
      if (allowed(i)) return;
      err(1, `${f}:${i + 1} — literal color outside the token files: ${raw[i].trim()}`);
    });
  }

  // Rule 2 — a var() nothing declares. This is what turns an upstream removal
  // into a red build instead of a blank color.
  //
  // `var(--x, fallback)` is exempt. Supplying a fallback is the author saying
  // out loud what happens when the token is absent, which is the entire thing
  // this rule exists to prevent being silent about. Both hits in the first run
  // over Unicron were of that shape and neither was a bug.
  for (const f of codeFiles) {
    const lines = strip(readFileSync(f, "utf8"), f).split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
        const [, name, next] = m;
        if (next === ",") continue;
        if (names.has(name) || declaredLocally.has(name)) continue;
        err(2, `${f}:${i + 1} — var(${name}) is not declared anywhere and has no fallback.`);
      }
    });
  }

  // Rule 6 — warning only. Upstream is a vocabulary; an app is a consumer, and
  // a consumer is allowed not to say every word.
  for (const name of names) {
    if (!used.has(name)) warn(6, `${name} is declared but never used under ${cssRoot}.`);
  }
}

// ---------------------------------------------------------------- report

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${errors.length} error(s), ${warnings.length} warning(s) — ${names.size} tokens across ${tokenFiles.length} file(s)`);
process.exit(errors.length ? 1 : 0);
