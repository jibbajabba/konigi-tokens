# Plan

Where this repo is, what's left, and the decisions that are still open. The
README says what the repo *is*; this says what it's becoming and in what order.

## Where we actually are

- `tokens.css` holds **61 tokens**, values verified identical to Unicron's
  `src/styles/tokens.css` as of commit `fcfab7f`. Nothing has drifted yet.
- `--graph-*` already excluded. Correct — Unigraph has no graph.
- Storybook 10 with a self-parsing catalog. Stage A of the README roadmap: done.
- No remote, no tag, no lint, no CI. Neither app consumes this yet.

The starting position is better than it looks. I diffed both apps' token files
by name and by value, in both themes: **Unigraph's set is a strict subset of
Unicron's, 38 shared names, zero value conflicts, zero Unigraph-only tokens.**
This was never a merge. It's an extraction, and the hard part — agreeing on
values — is already done.

## The 11 that shouldn't be here — done

The README rule is right: *a token earns a place only when more than one app
already has it and they already agree what it means.* Eleven tokens failed that
test and came out:

```
--console-bg  --console-text  --console-muted
--console-dim  --console-add  --console-remove
--toast-muted
--archived  --archived-text  --star
--chrome
```

A diff console and a graph canvas are Unicron's problem. These go back to
`brain-app/src/styles/tokens.local.css` at step 5, leaving **50 shared**.

I had this at thirteen, and two of them were wrong. `--toast-accent` and
`--toast-accent-hover` stay. The test I ran was "does Unigraph reference
`var(--toast-accent)`" — it doesn't, so out they went. But Unigraph hardcodes
`#8aa9ff` and `#acc1ff` in `.snackbar-undo`, byte-identical, under a comment
giving the same reason the shared file gives: the toast is dark in both themes,
so the accent has to read against dark either way. Both apps have them and both
agree what they mean, which is the whole rule. Grepping for `var()` measures
what an app *uses*; the rule is about what an app *has*, and a literal counts.
Putting them upstream is also what lets step 6 replace those two literals.

The other eleven were checked the same way, by value rather than by reference,
and none of them appear in Unigraph. Two near-misses that are coincidence, not
usage: `#1f1d1a` is `--console-bg` here but `--toast-bg` and `--text` there, and
`#8b867d` is `--console-muted` here but `--muted` there.

One of them, `--rail-glass`, is deliberately unused in Unicron and kept for
alignment. That's fine here and should be a warning, not an error, in the apps.
Upstream is a vocabulary; an app is a consumer.

`--tb-rim-top` was the other one, and it came out at 2.0.0. Unigraph was the
reason it was kept, and once Unigraph adopted `--shadow-control` nothing painted
it in either app. A token no app paints is the junk drawer this file exists to
avoid.

## What Unigraph has to change

The only real work in adopting this. Three things, all in `src/App.css`, none in
tokens:

1. **`.seg` hardcodes `0 1px 5px rgba(0,0,0,0.14)`** while `.tb-btn` uses
   `0 1px 4px rgba(0,0,0,0.1)` — a segmented track casting a heavier shadow than
   the buttons beside it. Both move to `--shadow-control`.
2. **`.seg button:hover:not(.active)` uses `--hover` (0.26)** against a
   `.seg-indicator` of `--selected-strong` (also 0.26). Hovering an unselected
   segment fills it exactly as much as the selected one. This is a live bug, and
   it's the same one `--seg-hover` was introduced to fix in Unicron's tabs.
3. **Six `:root[data-theme="dark"]` override blocks** apply the glass treatment
   to `.tb-btn` and `.seg` by selector. They get deleted in favour of the
   `--control-*` swap, which reaches every raised control instead of two.

Decision attached to (1): the shared `--shadow-control` is the **uniform** rim,
one `inset 0 0 0 1px`, no brighter top edge. Unigraph loses its lit-from-above.
That layer only paints where a shape has a flat top, so it lit wide pills and
skipped round buttons — obvious in Unicron's mixed toolbar, hidden in Unigraph's
mostly-round one. Unigraph took the uniform rim. An app that wants the old
two-layer edge back overrides `--shadow-control` in its own token file; don't
fork the shared token.

## Lint

The rules matter more than the usual "no hardcoded hex," because that rule would
have caught almost none of the real bugs found in the Unicron audit.

| # | Rule | Why |
|---|---|---|
| 1 | No literal colors outside the token files | The audit took Unicron from 56 literal lines to 13, and 9 of those are diagram hues that stay literal. |
| 2 | No undefined `var(--x)` | Typos, and tokens removed upstream that an app still uses. This is what makes a major bump fail a build instead of blanking a color. |
| 3 | Defined in both themes, or allowlisted | A light-only token silently resolves to nothing in dark. `--console-*` and `--toast-accent*` are deliberately theme-invariant and must say so. |
| 4 | Alpha ladders hold | **The one that earns its keep.** |
| 5 | No `--token:` inside a comment | A comment containing `--hover:` reads as a declaration to any regex parser and swallows the next real token. This broke a verifier mid-audit. |
| 6 | Defined but unused | Warning in apps, allowed here. |

### Rule 4, spelled out

Every neutral fill in the system is one gray at a different alpha, so the whole
thing reduces to an ordering. Break the ordering and a control lies about what's
selected. Two real examples from the audit, both using *correct tokens*:

- `.kind-tab` hovered at `0.26` against a selected state of `0.14`.
- `.settings-tab` the same.

Pointing at an unselected tab made it look more chosen than the chosen one. No
literal was involved. Nothing but an ordering assertion would have caught it.

```
light   --seg-hover < --selected-soft < --selected < --selected-strong < --selected-hover
        0.10          0.14              0.16         0.26                0.34

dark    --tb-fill < --seg-hover < --tb-fill-hover < --tb-fill-active < --selected-hover
        0.035       0.07          0.09              0.16               0.22

equal   --hover === --selected-strong  (light)
```

That last line is an assertion too. A hovered button and a selected one read
alike on purpose; breaking it silently changes what "engaged" means.

Chains only compare tokens sharing an rgb base. Light is all
`rgba(120,120,128,·)`; dark mixes a white family and a gray family, so it needs
two chains.

## CI

Three workflows, all running the same `scripts/check.mjs`.

- **Here, on PR.** Rules 3, 4, 5 against `tokens.css`.
- **Each app, on PR.** Same script plus rules 1, 2, 6 over the app's CSS. Where
  an upstream removal surfaces as a red build.
- **Canary, on tag.** `repository_dispatch` into both apps: bump the pin on a
  branch, build, open a PR. It merges nothing. It just means a token change
  can't sit unnoticed in one app for a month.

Semver for a token package. The version is the *package's*, not any app's —
Unicron is on 0.22.2 and Unigraph on 0.3.0, and adopting this doesn't touch
either. Keep `package.json`'s version field and the git tag in step; a `github:`
dependency resolves by ref and won't complain if they drift, which is exactly
why they do.



- **major** — a token is removed or renamed. Breaks consumers via rule 2, which
  is the point.
- **minor** — a token is added, or a value changes. Visually reviewed through
  the canary PR.
- **patch** — comments, docs, ordering.

## Storybook

Stage A is done and it's the right first stage: the catalog parses `tokens.css`
rather than listing tokens by hand, so it can't drift.

Two pieces of Storybook work are worth separating, because they have very
different dependencies.

**Now — make the catalog openable.** It builds clean today, but
`storybook-static` is gitignored and the dev server is localhost only. The
README's own stop condition is *"if stage A isn't getting opened, none of B–D is
worth the maintenance"* — and nothing gets opened when it lives on port 6006 on
one machine. Publish it to GitHub Pages from CI on every push to `main`. That
single change is what turns the catalog from a thing you remember to run into a
URL you check. Do this before any of the adoption plumbing below.

The **ladder story** belongs in this first push too: the neutral chains rendered
as swatch strips in both themes, reading the same `invariants.json` the linter
does. It makes rule 4 legible instead of abstract, and it's the story you'd
actually open while tuning a value. It needs `invariants.json` to exist, so it
follows the lint work rather than preceding it.

**Done — `controls.css`,** at 2.1.0, and a third the size this section imagined.
What moved is what both apps had and agreed on, which is the bar a token has to
clear: `.tb-btn` with its three states, and the segmented track, its buttons,
the hover and the sliding indicator. Ten rules, no literals.

Unicron has 28 rules using the control tokens and Unigraph has 8, and
Unigraph's 8 are exactly the overlap. The other 20 — `.ghost`, `.search`,
`.meta-pick`, `.kind-tab`, the tasks and brief buttons — are Unicron's alone
and stayed there.

Foundations → Controls renders the real classes from the real file.

This one genuinely wants both apps consuming the package first. Until they do,
you'd be writing a shared control layer against two apps that still hold their
own copies, and any divergence stays invisible until adoption forces it into the
open. The catalog has no such dependency — tokens *are* the shared artifact
already — which is exactly why it goes first and this doesn't.

Two things worth knowing before starting it:

- Unicron's control layer is now genuinely portable. State lives in the
  `--control-*` tokens, so `.tb-btn`, `.ghost`, `.search`, the pills and the
  segmented tracks are all the same four rules with different geometry.
- Geometry was reconciled deliberately rather than dodged: both apps are 31px
  with a 19px icon now, and `controls.css` carries it. A control layer that
  ships the material but not the size leaves every consumer re-deriving the
  same numbers.
- `.view-seg` is the exception and stayed local in both. Measured, it's 29px in
  Unicron and 31px in Unigraph, and that isn't drift — Unigraph's shares the
  top-bar row with `.tb-btn` and has to match it, Unicron's sits on the note
  header. Geometry that depends on where a control lives isn't shared geometry.

The catalog should grow a **ladder story** before it grows anything else: the
neutral chains rendered as swatch strips in both themes, reading the same
`invariants.json` the linter does. It makes rule 4 legible instead of abstract,
and it's the story you'd actually open when tuning a value.

## Figma — future work, not scheduled

Not planned for the near term. It's recorded here because the constraints below
were worked out against the real token set, and they'd otherwise have to be
rediscovered. Nothing in stages A or B depends on any of it.

One thing it does settle now: **keep `tokens.css` as the source.** The pull
toward a JSON-first pipeline is usually Figma, and since Figma isn't coming
soon, there's no reason to carry a build step for it. Generation, when it
happens, runs one way — CSS → Figma — and a restyle done in Figma is a proposal
until it lands here.

Three constraints the generator will have to handle, none of them obvious:

**Shadows aren't variables.** Figma has no shadow variable type. The six
`--shadow-*` tokens become **Effect Styles**, not Variables, and they don't
participate in mode switching the way variables do — you get one style per
theme, or two styles named for the theme.

**Three tokens aren't colors.** In light, `--control-hover`,
`--control-selected` and `--control-selected-hover` are multi-layer background
values:

```css
--control-hover: linear-gradient(var(--hover), var(--hover)), var(--panel);
```

Figma Variables have no gradient type. But these are a known alpha over a known
opaque panel, so they flatten to a solid — `--control-hover` in light is
`rgba(120,120,128,0.26)` over `#ffffff`, which is `#dcdcde`. The generator
composites them and emits solid colors. Worth a comment in the output saying the
Figma value is a flattened composite, so nobody hand-edits it back.

**Aliases should stay aliases.** `--control-bg: var(--panel)` is a reference,
not a copy. Figma Variables support aliasing, so emit it as one — otherwise
changing `--panel` upstream leaves Figma with a stale duplicate and the whole
"code is truth" claim quietly stops being true.

Shape of the output: **one collection, two modes** named Light and Dark,
mirroring `data-theme`. A Figma mode switch then does what the app's theme
toggle does.

Two ways to get there:

- **Generated JSON + a Variables import.** `scripts/derive-figma.mjs` reads
  `tokens.css` and writes `figma.tokens.json`. Portable, diffable, reviewable in
  a PR, and it works with whatever plugin you like. The JSON is a build
  artifact, never edited by hand.
- **Drive Figma directly** via the Figma MCP / Plugin API, no intermediate file.
  Fewer moving parts, but nothing to review before it lands and no record of
  what was pushed.

The first, when the time comes. The JSON is cheap, and having the generated
artifact in the diff is what makes a token change reviewable *as a design
change* rather than as a side effect.

Stage D — `@storybook/addon-designs` to embed Figma frames beside stories, and
Code Connect to map Figma components to real code — sits behind C and is
correspondingly further out.

## Order

Storybook leads. The catalog is what makes every step after it reviewable — you
want to *see* the token set change when the 13 come out, not infer it from a
diff.

**Get the catalog live**

1. Split the 13 back out. The catalog should drop to 48.
2. `check.mjs` + `invariants.json`, CI here.
3. Ladder story, reading `invariants.json`.
4. Publish Storybook to GitHub Pages from CI. Tag `v1.0.0`.

**Then the apps**

5. Unicron adopts — a file split and one import, no value changes.
6. Unigraph adopts — the three fixes above.
7. CI in both apps, then the canary.

**Then the shared control layer**

8. `controls.css`, once both apps are consuming cleanly.

Steps 1–4 are a sitting's work and leave you with a URL. 5–7 are mechanical.
Step 8 is real design work and shouldn't start against apps that haven't adopted
yet, or you'll be tuning a shared layer against a moving target.

Figma is future work. See above.
