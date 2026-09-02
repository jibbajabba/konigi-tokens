# @konigi/tokens

Design tokens shared across Konigi apps — Unigraph, Unicron, and whatever comes
next. Color, elevation, and radii, with a light and a dark value for every
token.

## Code is truth

`tokens.css` is the source. The Figma library is generated *from* it, never the
other way round.

That's a deliberate call, not an accident of order. Values get tuned live
against a running app — nudge `--tb-rim-top`, watch HMR, nudge again — and a
Figma-upstream pipeline would put an export step inside that loop. It also means
no build step: no Style Dictionary, no Tokens Studio, nothing between an edit
and a hot reload.

The consequence to accept: restyling in Figma is a *proposal*. It isn't real
until it lands in `tokens.css`.

## Using it

```bash
npm i file:../konigi-tokens
```

```css
@import "@konigi/tokens/tokens.css";  /* shared core first */
@import "./styles/tokens.css";        /* the app's own tokens second */
```

Order matters. Later wins, so an app can override a shared token on purpose —
and that override then shows up in a diff instead of hiding inside a divergent
copy of the whole file.

A `file:` dependency is a symlink, so edits here appear in a running app
immediately. That's the point during development; before shipping a release,
switch to a git dependency at a tag so the build pins a known version.

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

App-specific tokens stay in each app's own `src/styles/tokens.css`. Unicron's
graph colors are the clearest example — Unigraph has no graph and never will.

## Storybook

```bash
npm run storybook        # dev server on :6006
npm run build-storybook  # static build
```

One story today: **Foundations → Tokens**, a catalog of every token with light
and dark side by side.

It reads `tokens.css` and parses it at load rather than listing tokens by hand.
A hand-written list is a second source of truth and starts lying the first time
someone adds a token without remembering this file exists. Section headings come
from the stylesheet's own comments, so the catalog inherits the organisation
that's already in the file.

## Roadmap

Full detail in [docs/PLAN.md](docs/PLAN.md); the sequential steps for getting
both apps onto this package are in [docs/RUNBOOK.md](docs/RUNBOOK.md).

Staged, and each stage is useful on its own:

- **A — token catalog.** Done. Zero drift risk: tokens *are* the shared artifact.
- **B — the control layer.** Move the button/pill/segmented/menu CSS here as
  `controls.css` so both apps import it and the stories render the real thing.
  A Storybook of demo components that merely resemble the apps' is a museum.
- **C — Figma library.** Generated from `tokens.css`: Variables for every token,
  light and dark as modes on one collection so a Figma mode switch mirrors
  `data-theme`.
- **D — the bridge.** `@storybook/addon-designs` to embed Figma frames in story
  panels; Code Connect to map Figma components to real code.

Stop condition: if stage A isn't getting opened, none of B–D is worth the
maintenance.
