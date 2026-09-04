/**
 * The one parser for tokens.css. Imported by scripts/check.mjs and by the
 * stories, so the linter, the catalog and the ladder strips can't disagree
 * about what the file says — the same reason the catalog parses the stylesheet
 * instead of listing tokens by hand.
 *
 * Plain .mjs with JSDoc rather than .ts, because check.mjs runs under bare node
 * in CI and shouldn't need a build step to lint a stylesheet.
 */

/**
 * Blank every comment, preserving both length and line breaks so character
 * offsets and reported line numbers still point into the original.
 *
 * Searching the raw text finds prose that mentions a selector instead of the
 * rule itself. The header of tokens.css documents `:root[data-theme="dark"]`,
 * and matching that sentence handed back the light block — which printed light
 * values under "dark" in the catalog until someone looked closely.
 *
 * @param {string} css
 * @returns {string}
 */
export const mask = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/**
 * The body of the first top-level block whose selector starts with `sel`.
 * @param {string} css
 * @param {string} sel
 * @returns {string}
 */
export function block(css, sel) {
  const m = mask(css);
  const at = m.indexOf(sel);
  if (at === -1) return "";
  const open = m.indexOf("{", at);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < m.length; i++) {
    if (m[i] === "{") depth++;
    else if (m[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  return "";
}

/**
 * Every `--name: value;` in a block body. Values may wrap across lines, which
 * --control-selected does.
 * @param {string} body
 * @returns {Map<string, string>}
 */
export function declarations(body) {
  /** @type {Map<string, string>} */
  const out = new Map();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(mask(body)))) out.set(m[1], m[2].trim().split(/\s+/).join(" "));
  return out;
}

/**
 * Both theme blocks of a stylesheet.
 * @param {string} css
 * @returns {{ light: Map<string, string>, dark: Map<string, string> }}
 */
export const themes = (css) => ({
  light: declarations(block(css, ":root {")),
  dark: declarations(block(css, ':root[data-theme="dark"]')),
});

/**
 * What a token actually resolves to under a theme, cascade included: dark
 * inherits light for anything it doesn't redeclare.
 * @param {{ light: Map<string, string>, dark: Map<string, string> }} t
 * @param {"light" | "dark"} theme
 * @param {string} name
 * @returns {string | undefined}
 */
export const valueIn = (t, theme, name) =>
  theme === "dark" ? t.dark.get(name) ?? t.light.get(name) : t.light.get(name);

/**
 * `rgba(r, g, b, a)` split into a base and an alpha. Anything else — a hex, a
 * gradient, a var() — returns null, because only same-base rgba tokens can be
 * ordered against each other.
 * @param {string | undefined} value
 * @returns {{ base: string, alpha: number } | null}
 */
export function rgba(value) {
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(value ?? "");
  if (!m) return null;
  return { base: `${m[1]},${m[2]},${m[3]}`, alpha: m[4] === undefined ? 1 : Number(m[4]) };
}
