# Runbook

The plan as commands. Written against the repo as it actually is — Storybook and
`tokens.css` already exist, so this picks up from there rather than from
`git init`.

Steps 1–4 get the catalog live and are worth doing in one sitting. 5–7 put both
apps on the package. `controls.css` and Figma are later; see
[PLAN.md](PLAN.md).

Commit both app working trees before you start. Step 5 deletes
`brain-app/src/styles/tokens.css`.

---

## 1 · Split the 11 back out — done

They're Unicron's. Cut from `tokens.css` here; they land in the app at step 5,
since `brain-app/src/styles/tokens.css` still holds its own full copy and
writing `tokens.local.css` now would only make a third one.

```
--console-bg  --console-text  --console-muted  --console-dim
--console-add  --console-remove  --toast-muted
--archived  --archived-text  --star  --chrome
```

Not `--toast-accent` / `--toast-accent-hover` — Unigraph hardcodes both values
in `.snackbar-undo`, so they clear the bar. See PLAN.md.

Each has a comment block above it explaining why it exists — move the comment
with the token, it's the part that stops someone re-adding it later. Both the
`:root` and `:root[data-theme="dark"]` blocks need doing; several of these are
deliberately declared in light only.

```bash
cd ~/Sites/konigi-tokens
$EDITOR tokens.css
npm run storybook   # the catalog should now show 50, and still group correctly
```

**Verify.** `grep -c -- '^\s*--' tokens.css` and the catalog agree. No name
appears both here and in the app's local file.

---

## 2 · Rules and CI — done

`scripts/check.mjs` and `invariants.json` don't exist yet — the token differ and
the ladder assertion were both written and run during the audit, so this is
mostly transcription. `invariants.json` holds three things: `themeInvariant`
(the allowlist), `ladders` (the chains from the plan), `equals` (the deliberate
`--hover === --selected-strong`).

```bash
mkdir -p scripts .github/workflows
$EDITOR scripts/check.mjs invariants.json .github/workflows/ci.yml
node scripts/check.mjs --tokens tokens.css --invariants invariants.json
```

Add to `package.json`:

```json
"scripts": {
  "check": "node scripts/check.mjs --tokens tokens.css --invariants invariants.json"
},
"files": ["tokens.css", "invariants.json", "scripts"],
"exports": {
  ".": "./tokens.css",
  "./tokens.css": "./tokens.css",
  "./invariants.json": "./invariants.json",
  "./check": "./scripts/check.mjs"
}
```

`"private": true` blocks `npm publish`, which is fine — a `github:` dependency
installs over git and ignores it. Drop it only if you ever want a registry.

```bash
gh repo create jibbajabba/konigi-tokens --public --source=. --remote=origin
git add -A && git commit -m "Token rules and CI"
git push -u origin main && git tag v1.0.0 && git push --tags
```

**Verify.** `0 error(s)`. Then open a throwaway PR setting `--seg-hover` to
`0.30` and confirm CI fails with the ladder message. Close it without merging.
That one test proves the whole apparatus — it's the failure mode with no other
tripwire.

Private repo instead of public? CI runners need read access for `npm ci`: a
deploy key or a machine user. Public is genuinely less work, and Pages in step 4
is free on a public repo.

---

## 3 · Ladder story — done

The chains from `invariants.json`, rendered as swatch strips in both themes. It
reads the same file the linter does, so the two can't disagree — the catalog is
already parsing `tokens.css` at load for exactly that reason, and this follows
the pattern.

```bash
$EDITOR stories/Ladders.stories.tsx
npm run storybook
```

**Verify.** Every chain reads left-to-right lighter to heavier, in both themes.
If a strip looks wrong here, the linter would also fail — same numbers, two
presentations.

---

## 4 · Publish the catalog — done

Live at <https://jibbajabba.github.io/konigi-tokens/>.

`configure-pages` can't switch Pages on itself — the workflow token gets
"Resource not accessible by integration" on the create call even with
`pages: write`. One `gh api -X POST repos/OWNER/REPO/pages -f build_type=workflow`
first, or the settings toggle below.

`storybook-static` is gitignored and the dev server is localhost only, so today
nobody opens it. Pages fixes that, and the README's stop condition depends on it
being openable.

```yaml
# .github/workflows/pages.yml
name: pages
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build-storybook
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: storybook-static }
      - id: deploy
        uses: actions/deploy-pages@v4
```

Turn on Pages in the repo settings with **Source: GitHub Actions**, then tag:

```bash
git tag v1.0.0 && git push --tags
```

**Verify.** The catalog opens at the Pages URL and shows 48 tokens, light and
dark side by side. That URL is the artifact — bookmark it.

---

## 5 · Unicron adopts — done

On branch `adopt-konigi-tokens` in `~/Sites/brain-app`, pinned at `v1.0.1`.

Two corrections to what's written below. The six `--graph-*` tokens belong in
`tokens.local.css` too — the plan calls them "already excluded", meaning from
upstream, not that Unicron doesn't have them, and building the local file from
the thirteen-token list alone drops them. And the built CSS is *not* identical:
the shared file scopes dark as `:root[data-theme="dark"], [data-theme="dark"]`
where the app's used the single selector, so the output differs by 84 bytes of
selector text. Compare resolved token values instead — that's what actually
paints, and it's what caught the missing graph tokens.

`invariants.local.json` sits beside `package.json` and declares the app's
theme-invariant tokens, merged with the shared one by `check.mjs`.

No value changes, so the built CSS should come out identical.

```bash
cd ~/Sites/brain-app
npx vite build && cp dist/assets/index-*.css /tmp/before.css

npm i -S github:jibbajabba/konigi-tokens#v1.0.0
$EDITOR src/styles/tokens.local.css     # the 13 from step 1
rm src/styles/tokens.css
```

`src/main.tsx`:

```diff
-import "./styles/tokens.css";
+import "@konigi/tokens/tokens.css";
+import "./styles/tokens.local.css";
 import "./App.css";
```

```bash
npx tsc --noEmit && npx vite build
diff <(sort /tmp/before.css) <(sort dist/assets/index-*.css) && echo IDENTICAL

node node_modules/@konigi/tokens/scripts/check.mjs \
  --tokens node_modules/@konigi/tokens/tokens.css,src/styles/tokens.local.css \
  --css src \
  --invariants node_modules/@konigi/tokens/invariants.json
```

**Verify.** `IDENTICAL`, and the checker flags only the four known literals — the
two `::highlight()` rules, their `#1a1a1a`, and the switch knob's shadow. Mark
those `/* tokens-allow */` and re-run to reach zero.

---

## 6 · Unigraph adopts — done

On branch `adopt-konigi-tokens` in `~/Sites/unigraph`, pinned at `v1.0.2`. No
local token file — its 38 were a strict subset, so there was nothing to keep.

Beyond the three fixes below: the snackbar's two hardcoded accents became
`var(--toast-accent)`, a dead `var(--danger, #c0392b)` fallback came off, and
the `@media print` block keeps its ten literals under one block-scoped
`tokens-allow`. Two shadows — the tooltip's and the image view's — are marked
token candidates rather than retuned, since nothing shared matches them and
changing them isn't part of adopting the package.

Same two import lines. Its local file is empty, so skip that import entirely
rather than shipping an empty `:root {}`.

Then `src/App.css`, top-down (line numbers drift as you edit, so grep the
snippet instead):

**`.seg`** — `box-shadow: 0 1px 5px rgba(0, 0, 0, 0.14)` → `var(--shadow-control)`

**`.tb-btn` and `.view-seg`** — `box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)` →
`var(--shadow-control)`

**`.seg button:hover:not(.active)`** — the live bug:

```diff
 .seg button:hover:not(.active) {
-  color: var(--text);
-  background: var(--hover);
+  background: var(--seg-hover);
 }
```

**Delete all six `:root[data-theme="dark"]` blocks**, and rewrite the light
rules to go through the tokens:

```css
.tb-btn        { background: var(--control-bg);
                 box-shadow: var(--shadow-control); }
.tb-btn:hover:not(:disabled)
               { background: var(--control-hover); }
.tb-btn.active { background: var(--control-selected); }
.tb-btn.active:hover:not(:disabled)
               { background: var(--control-selected-hover); }
.seg           { background: var(--control-bg); }
.seg-indicator { background: var(--control-selected); }
```

**Verify.** `grep -c 'data-theme="dark"' src/App.css` returns `0`. Run it in both
themes: the toolbar buttons and the Preview/Edit switch should read as one
material, and hovering an unselected segment should now sit clearly below the
sliding pill instead of matching it.

---

## 7 · App CI, then the canary — CI done, canary needs a token

Both apps have `ci` (npm ci, `npm run check`, `tsc && vite build`, plus Unicron's
130 vitest tests) and both went green on the first run. Both app repos are
private and `konigi-tokens` is public, so their `npm ci` fetches the package
with no credentials.

`canary.yml` is in both apps and `release.yml` is here, all unfired — the
dispatch needs `CANARY_TOKEN`. `release.yml` also refuses a tag whose number
doesn't match `package.json`, which is the thing that quietly drifted for three
releases.

To finish: create a fine-grained PAT on `jibbajabba`, scoped to **unicron** and
**unigraph**, with **Contents: read and write** and **Pull requests: read and
write**. Then:

```bash
gh secret set CANARY_TOKEN -R jibbajabba/konigi-tokens
git tag v1.0.4 && git push origin v1.0.4   # bump package.json first, or verify fails
```

Two canary PRs should open. Close them — that run is the test.


Same workflow file in both apps: `npm ci`, `check.mjs`, `tsc --noEmit`,
`vite build`.

The canary goes last, once both are green. Upstream dispatches on a version tag;
each app answers by bumping the pin on a branch and opening a PR. Needs a
fine-grained PAT with **contents: write** and **pull-requests: write** on both
app repos, stored here as `CANARY_TOKEN` — the built-in `GITHUB_TOKEN` can't
dispatch across repositories.

---

## Done when

- [x] `tokens.css` holds 50; the 11 go to `brain-app/src/styles/tokens.local.css` at step 5
- [x] The catalog is a URL, not a localhost port, and shows 50 tokens
- [x] Tagged `v1.0.0`, `npm run check` clean
- [x] Unicron resolves all 67 tokens identically to its pre-split baseline, both themes
- [x] Unigraph has zero `data-theme="dark"` selectors in `App.css` (grep still finds one hit — it's prose in a comment)
- [x] Both apps pin the same tag (`v1.0.3`), both lockfiles committed
- [x] A deliberately broken ladder fails the checker, and shows red in the ladder story

Rollback at any point: `npm rm @konigi/tokens`, restore `src/styles/tokens.css`
from git, revert the `main.tsx` import. Nothing here touches app logic.
