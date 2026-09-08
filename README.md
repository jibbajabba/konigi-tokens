# @konigi/tokens

Design tokens and the shared control layer for Konigi apps — Unigraph, Unicron,
and whatever comes next. Color, elevation and radii, with a light and a dark
value for every token, plus the button and segmented-control rules both apps
were keeping their own copies of.

**Catalog: <https://jibbajabba.github.io/konigi-tokens/>**

## How it all works

Three files ship, and everything else here exists to check them or look at them.

| | |
|---|---|
| `tokens.css` | 49 tokens. Light values in `:root`, dark in `:root[data-theme="dark"]`. |
| `controls.css` | `.tb-btn` and the segmented control, written entirely in those tokens. |
| `invariants.json` | The assertions a regex can't infer — theme-invariant tokens, the alpha ladders, one deliberate equality. |

Each app installs the package at a git tag and imports the two stylesheets
before its own CSS. Nothing is generated and there's no build step: a token is a
CSS custom property, and an app gets it by importing the file.

`scripts/check.mjs` enforces six rules and runs in all three repos. Three of
them need only the stylesheet and run here; the other three need an app's own
CSS and run there. That split is the whole safety net — when a token is removed
upstream, rule 2 fails the build of any app still painting it, so a removal
can't quietly blank a color.

Releasing is one tag. `release.yml` refuses a tag whose number disagrees with
`package.json`, then dispatches to both app repos. Each answers by bumping its
pin on a branch and opening a PR, which its own CI then judges. Nothing merges
by itself. The point is narrow: a token change can't sit unnoticed in one app
for a month, and a breaking one gets proven safe by two real builds rather than
by my say-so.

```
tokens.css ─┐
            ├─ npm i github:jibbajabba/konigi-tokens#v2.1.1 ─→ Unicron
controls.css┘                                              └─→ Unigraph
     │                                                            │
     ├─ check.mjs (rules 3,4,5) ── CI here                        │
     └─ check.mjs (rules 1,2,6) ─────────────────────── CI in each app
                                                                  │
     git tag v… ─→ release.yml ─→ canary PR in both apps ─────────┘
```

## Code is truth

`tokens.css` is the source. The Figma library is generated *from* it, never the
other way round.

That's a deliberate call, not an accident of order. Values get tuned live
against a running app — nudge `--tb-fill`, watch HMR, nudge again — and a
Figma-upstream pipeline would put an export step inside that loop. It also means
no build step: no Style Dictionary, no Tokens Studio, nothing between an edit
and a hot reload.

The consequence to accept: restyling in Figma is a *proposal*. It isn't real
until it lands in `tokens.css`.

## Using it

```bash
npm i -S github:jibbajabba/konigi-tokens#v2.1.1
```

Then in the app's entry file, in this order:

```ts
import "@konigi/tokens/tokens.css";     // the vocabulary
import "./styles/tokens.local.css";     // the app's own tokens, if it has any
import "@konigi/tokens/controls.css";   // the control layer, built on both
import "./App.css";                     // the app, which can override anything above
```

Order matters, and later wins. An app can override a shared token deliberately,
and that override then shows up in a diff instead of hiding inside a divergent
copy of the whole file. `controls.css` goes before the app's CSS for the same
reason — `.view-seg` has to be able to beat `.seg`.

Pin a tag, not a branch. That's what makes an upstream change arrive as a canary
PR you can look at rather than as a surprise on someone's next `npm install`.
For a tight edit loop, `npm i file:../konigi-tokens` symlinks the working copy
so changes here hot-reload in a running app; switch back to a tag before
committing.

## Theming

Theme resolves to an explicit light or dark in JS (auto follows the OS) and gets
written to `<html data-theme>`. Every token has both values, so **components
reference `var(--token)` and never branch on theme themselves.**

If a component needs a `[data-theme="dark"]` rule, that's the signal a token is
missing here. Add the token; don't branch in the component.

The dark block is scoped to `:root[data-theme="dark"], [data-theme="dark"]`. The
first half is what the apps match on `<html>`, at unchanged specificity. The
second lets any element opt in, which is what makes the side-by-side preview in
Storybook possible without duplicating a single value.

## What belongs here

A token earns a place only when **more than one app already has it and they
already agree what it means.** Not when one app might want it later. That rule
is the only thing keeping this from becoming a junk drawer of one-offs.

App-specific tokens stay in the app, in its own `tokens.local.css`. Unicron's
graph colors are the clearest example — Unigraph has no graph and never will.

Apply the rule by **value, not by `var()` reference**. An app that hardcodes
`#8aa9ff` has the token; it just hasn't spelled it as one yet. I cut
`--toast-accent` on a `var()` grep once and had to put it straight back, because
Unigraph was painting the same hex with the same reasoning written above it.

The same bar governs `controls.css`. Unicron has 28 rules using the control
tokens and Unigraph has 8, and Unigraph's 8 are exactly the overlap — so those
8 moved and the other 20 stayed. `.ghost`, `.search` and `.meta-pick` are
Unicron's alone, and a shared file full of one app's components is the junk
drawer by another name.

## The rules

`scripts/check.mjs` reads `invariants.json` and enforces six things.

| # | Rule | Runs |
|---|---|---|
| 1 | No literal colors outside the token files | in the apps |
| 2 | No `var(--x)` that nothing declares | in the apps |
| 3 | Declared in both themes, or allowlisted | here |
| 4 | The alpha ladders hold | here |
| 5 | No `--token:` written inside a comment | here |
| 6 | Declared but never used (warning) | in the apps |

Rule 4 is the one that earns its keep. Nearly every neutral fill is one gray at
a different alpha, so the system reduces to an ordering — and when the ordering
breaks, a control lies about its own state without a single wrong token name.
Three shipped controls hovered heavier than their selected state before anyone
noticed, all three using correct tokens. Nothing but an ordering assertion
catches that.

`/* tokens-allow */` opts a line out of rule 1, and on a line that opens a block
it covers the whole block. Print styles are the honest case: print has no theme,
so those literals are correct.

## Storybook

```bash
npm run storybook        # dev server on :6006
npm run build-storybook  # static build
```

Published to <https://jibbajabba.github.io/konigi-tokens/> on every push to
`main`, which is the point — a catalog living on someone's localhost is a
catalog nobody opens.

- **Foundations → Tokens.** Every token, light and dark side by side.
- **Foundations → Ladders.** The alpha chains as swatch strips, so rule 4 is
  something you can see rather than a table of numbers to hold in your head.
- **Foundations → Controls.** The real classes from `controls.css`, not
  look-alikes. Hover them.

None of the three hand-lists anything. The catalog parses `tokens.css` at load
and the ladders read the same `invariants.json` the linter reads, so a story
can't drift from what it documents. A hand-written list is a second source of
truth and starts lying the first time someone adds a token without remembering
the story exists — which is exactly what happened once already: the catalog
walked only the light block, so five dark-only tokens were invisible in it for
weeks.

## Releasing

```bash
npm version <next> --no-git-tag-version
git commit -aqm "<next>" && git push origin main
git tag v<next> && git push origin v<next>
```

Then wait a few minutes and look for the canary PRs. Checking straight after
pushing the tag finds nothing — the chain runs two `npm ci` installs and a build
before it gets there.

- **major** — a token is removed or renamed. Breaks consumers through rule 2,
  which is the point.
- **minor** — a token is added, a value changes, or a file is added.
- **patch** — tooling, comments, docs.

The version in `package.json` has to match the tag or `release.yml` refuses it.
A `github:` dependency resolves by git ref and never reads the version field,
which is exactly how the two drifted apart for three releases without anything
complaining.

## Roadmap

Full detail in [docs/PLAN.md](docs/PLAN.md); the sequential steps for getting
both apps onto this package are in [docs/RUNBOOK.md](docs/RUNBOOK.md).

Staged, and each stage is useful on its own:

- **A — token catalog.** Done, and published.
- **B — the control layer.** Done, and smaller than planned. `controls.css`
  holds `.tb-btn` and the segmented control — the rules both apps had and
  agreed on, which is the same bar a token has to clear. Unicron's `.ghost`,
  `.search`, `.meta-pick` and the rest stayed put: one app having them is
  exactly the junk drawer that rule exists to prevent. `.view-seg` stayed too,
  because the two apps need different heights for it — Unigraph's shares the
  toolbar row with `.tb-btn`, Unicron's sits in the detail actions.
  Foundations → Controls renders the real classes, not look-alikes.
- **C — Figma library.** Generated from `tokens.css`: Variables for every token,
  light and dark as modes on one collection so a Figma mode switch mirrors
  `data-theme`.
- **D — the bridge.** `@storybook/addon-designs` to embed Figma frames in story
  panels; Code Connect to map Figma components to real code.

Stop condition: if stage A isn't getting opened, none of B–D is worth the
maintenance.
