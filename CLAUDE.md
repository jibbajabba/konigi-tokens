# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

`@konigi/tokens` — one CSS file of design tokens shared by two apps, plus a
Storybook that catalogs it. There is no build step, no Style Dictionary, no
token JSON. `tokens.css` is the artifact; everything else exists to look at it.

The consumers:

- **Unicron** — `~/Sites/brain-app` (its token file: `src/styles/tokens.css`)
- **Unigraph** — `~/Sites/unigraph` (`src/styles/tokens.css`, styles in `src/App.css`)

Neither app consumes this package yet. The adoption sequence is written out in
`docs/RUNBOOK.md`; the reasoning behind it is in `docs/PLAN.md`. Read both
before touching anything structural — most decisions here already have a
recorded rationale, and re-deciding them is wasted work.

## Commands

```bash
npm run storybook        # dev server on :6006
npm run build-storybook  # static build into storybook-static/ (gitignored)
npx tsc --noEmit         # typecheck; there is no test suite and no linter yet
```

`scripts/check.mjs`, `invariants.json`, and `npm run check` appear throughout
the plan and runbook. **They don't exist yet.** Don't cite them as if they run.

## The rules that actually matter

**Code is truth.** Figma is generated from `tokens.css`, one direction only. A
restyle done in Figma is a proposal until it lands in this file.

**A token earns a place here only when more than one app already has it and
they already agree what it means.** Not when one app might want it later. That
rule is the only thing keeping this from becoming a junk drawer. App-specific
tokens stay in the app. Thirteen tokens that failed this test — `--console-*`,
`--toast-accent*`, `--archived*`, `--star`, `--chrome` — were cut in runbook
step 1; they're Unicron's and still live in `brain-app/src/styles/tokens.css`.
The file holds **48** now. If you add one, it has to clear the same bar.

**Never branch on theme in a component.** Every token has a light and a dark
value, so components reference `var(--token)` and nothing else. A
`[data-theme="dark"]` rule inside a component is the signal that a token is
missing here. Add the token.

**Alpha ladders hold.** Most neutral fills are one gray at different alphas, so
the system reduces to an ordering, and breaking the ordering makes a control lie
about what's selected — a hovered tab reading heavier than the selected one.
Real bugs of this shape used entirely correct tokens. If you change any alpha,
re-check the chains documented under "Rule 4, spelled out" in `docs/PLAN.md`,
including the deliberate equality `--hover === --selected-strong` in light.

## File structure

`tokens.css` has three blocks:

1. `:root` — light values, plus the non-token bits (`color-scheme`,
   `font-synthesis`). 43 of the 48 live here.
2. `:root[data-theme="light"], [data-theme="light"]`
3. `:root[data-theme="dark"], [data-theme="dark"]` — dark values, plus the
   five `--tb-*` glass tokens that exist *only* in dark.

Light and dark are not the same set, and nothing may assume they are. Five
tokens are dark-only; the three `--radius-*` are light-only and correctly so,
since a corner radius has no theme. They're the only theme-invariant tokens
left now that the console and toast-accent groups are gone, which is the
allowlist lint rule 3 will need.

The doubled selector is load-bearing. The `:root[...]` half is what the apps
match on `<html>` at unchanged specificity; the bare `[...]` half lets any
element opt in, which is what makes the side-by-side light/dark preview in
Storybook work without duplicating a single value. Don't collapse it.

Section comments (`/* surfaces */`, `/* elevation */`, and so on) are structure,
not decoration — the catalog reads them for its headings. Keep the format.

Three tokens in light are multi-layer backgrounds, not colors:
`--control-hover`, `--control-selected`, `--control-selected-hover` are a
`linear-gradient(alpha, alpha), var(--panel)`. That's what lets one overlay work
on any surface. Anything parsing this file has to survive them.

## Storybook

`stories/Tokens.stories.tsx` parses `tokens.css?raw` at load and renders every
token light and dark, walking the light block for section order and then
sweeping up whatever only dark declares. **Never hand-list tokens in a story.** A hand-written list
is a second source of truth and starts lying the first time someone adds a token
without remembering the story file exists.

Two traps already hit in that parser, both preserved in its comments:

- Comments are masked to spaces before any selector search, same length in and
  same length out so offsets still point into the original. The file's header
  prose mentions `:root[data-theme="dark"]`, and searching raw text matched the
  sentence instead of the rule — which handed back the light block and printed
  light values under "dark".
- A `--token:` written inside a comment reads as a declaration to a regex
  parser and swallows the next real token. This is also lint rule 5 in the plan.

`vite.config.ts` exists solely to pre-bundle React (`optimizeDeps.include`).
Vite 8 served React's CJS raw and the dev server died on "does not provide an
export named 'default'" while the static build stayed fine. Don't remove it.

## Writing here

Prose in this repo — README, PLAN, RUNBOOK, and the long comments in
`tokens.css` — is written in Michael's voice and carries the reasoning, not just
the what. When you edit those files, match that: state the decision and the
consequence to accept, and keep the comment attached to the token it explains.
Moving a token means moving its comment; that comment is the part that stops
someone re-adding it later.
