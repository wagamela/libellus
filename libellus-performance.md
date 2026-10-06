# Prompt: make libellus fast and lightweight

> Paste everything below the line into a Claude Code session opened on the
> `wagamela/libellus` repository. It is grounded in the code as of commit
> `4d40c98` ("imported graphify"); line references may drift, so re-read the
> files before acting on any of them.

---

## Role

You are a senior performance engineer working on **libellus**, a local-first
desktop developer workspace (notes and code snippets today; secrets and
utilities later). It is a Tauri 2 app: React 18 + TypeScript + Vite 6 +
Tailwind 4 in the webview, CodeMirror 6 as the editor, Zustand for state, and a
thin Rust backend that persists one JSON store.

Your job is to make libellus measurably faster and lighter **without changing
what it does or how it looks**. Every change must be justified by a measurement
taken before and after it.

## Read first

Before touching code, read these in full. They describe deliberate decisions,
not provisional ones:

1. `CLAUDE.md` — architecture, conventions and constraints.
2. `project_spec.md` — especially §4.2 *Fast* and §4.3 *Lightweight*: startup,
   search and normal interactions are technical requirements; avoid heavy
   dependencies, background services, large runtimes, expensive processing and
   repeated storage operations; do not consume significant CPU or memory while
   idle.
3. `design.md` and `README.md` — what the user sees and the keybindings that must
   keep working.

If `graphify-out/graph.json` exists, use `graphify query` / `graphify explain`
to navigate before grepping, and run `graphify update .` after code changes.

## Non-negotiable constraints

Treat a change that breaks any of these as a regression, however much faster it
is:

- **No new network access.** The CSP in `src-tauri/tauri.conf.json` stays as it
  is (`default-src 'self'`, inline styles, `data:` images and fonts). No CDNs,
  no telemetry, no remote fonts.
- **Tauri permissions stay `core:default`.** Do not widen
  `src-tauri/capabilities/default.json` or enable the asset protocol or
  filesystem scopes to win performance. If a fix truly needs one, stop and
  propose it instead of doing it.
- **One store, one save path.** Only `src/lib/storage.ts` knows where data
  lives; only `src/store/workspace.ts` mutates it; components never call
  storage. Saves stay atomic (write-temp-then-rename in `src-tauri/src/lib.rs`).
  If you change the persisted shape, bump `Store.version` and add a versioned,
  reproducible migration — never change the shape in place.
- **Rich content stays plain text.** Images, code blocks and emphasis are
  decorations over markdown the user could have typed. Do not add fields to
  `Doc` or cache derived data inside the document model.
- **Behaviour is frozen.** Autosave (~900 ms debounce, `flush()` on `Ctrl S`,
  delete and `beforeunload`), the `autoTitle` rule, fence guards, hidden-but-
  revealable emphasis markers, language detection results, image paste/drop,
  tab drag/reorder, `Ctrl Shift T` reopen, both palette modes and every
  shortcut in `README.md` must behave exactly as before.
- **Visuals are out of scope.** Do not change design tokens, radii, spacing,
  colours, typography or component styling in `src/styles.css` or components.
  Another stream of work is currently restyling components (rounded corners);
  stay out of style rules entirely so the two do not conflict. If a performance
  fix needs a CSS change (for example `contain` or removing a costly property),
  keep it to that property and call it out.
- **Lean dependencies.** Prefer removing code to adding a library. A new
  runtime dependency needs a measured reason and must be small. Dev-only
  tooling for measurement (e.g. a bundle visualiser) is fine.
- Grammars stay **lazy** (`loadLanguage` / `loadParser` in `src/lib/editor.ts`)
  and out of the startup bundle.

## Targets

Establish a baseline first, then aim for these. If a target is unrealistic on
the measured baseline, say so with numbers rather than quietly lowering it.

| Area | Target |
|---|---|
| Cold start (launch → caret blinking in the restored doc) | ≤ 400 ms on a mid-range Windows laptop, release build |
| Startup JS (initial chunk, minified) | Clearly below today's ~596 KB / ~196 KB gzip `index-*.js`; document what remains and why |
| Keystroke → paint in a 5 000-line note with 20 fenced blocks, 10 images and emphasis | p95 < 16 ms (no dropped frame) |
| Quick open (`Ctrl P`) results per keystroke with 2 000 docs / 20 MB of text | < 30 ms |
| Tab switch between two large documents | < 50 ms, with no layout jank |
| Idle | ~0 % CPU, no timers or rAF loops running when nothing changes |
| Memory | Webview + Rust RSS stable over a 30-minute edit session; no unbounded caches |
| Installer / binary size | Not larger than today; smaller is a bonus |

## Method

1. **Measure before changing anything.** Build a reproducible benchmark:
   - A seed script (dev-only, not shipped) that generates a large store: many
     notes and snippets, long notes with fenced blocks in several languages,
     image references and `**bold**` / `*italic*` / `<u>underline</u>` spans.
     Load it through the existing browser fallback (`npm run dev`, which uses
     `localStorage` / IndexedDB) and through the desktop app.
   - Record a Chrome/WebView2 performance profile for: cold start, typing a
     burst of 200 characters in the large note, scrolling it top to bottom,
     opening quick open and typing a query, switching tabs, and idling for
     60 s.
   - Capture bundle composition (`npm run build` output plus a visualiser such
     as `rollup-plugin-visualizer` in a dev-only config).
   - For the desktop shell, time `load_store` / `save_store` on the large store
     and note RSS of the app process.
2. **Rank by impact**, then fix one thing at a time, re-measuring after each.
3. **Verify** after every change: `npm run build` (the only automated check —
   it runs `tsc --noEmit`), `cargo check` in `src-tauri/` for Rust changes, and
   a manual pass over the behaviours listed above in `npm run app`.

## Where to look

These are hypotheses from reading the code. Confirm each with a profile before
fixing it; drop any the measurements do not support.

### 1. React re-renders the whole shell on every keystroke

- `src/App.tsx` subscribes with `const store = useWorkspace()` — no selector —
  so every `set()` re-renders `App` and everything under it. `updateBody` →
  `touch()` in `src/store/workspace.ts` replaces the `docs` record, clones the
  `dirty` Set and sets `status: "modified"` on **every keystroke**.
- `commands`, `buildCommands` and `buildOpen` in `App.tsx` depend on `store`,
  so they are rebuilt per keystroke too; `TabBar`, `StatusBar`, `MenuBar` and
  `Editor` receive fresh props each time.
- Direction: narrow subscriptions with selectors (`useShallow` from
  `zustand/react/shallow` for tuples), read actions via `useWorkspace.getState()`
  inside callbacks, avoid re-setting `status` when it is already `"modified"`,
  and memoise children whose props did not change. Keep App.tsx as the command
  hub — this is about subscriptions, not moving commands into components.

### 2. Whole-document work per keystroke in the editor

- `Editor.tsx`'s update listener calls `update.state.doc.toString()` on every
  change and hands the full string to the store; `deriveTitle` then splits the
  entire body into lines to find the first meaningful one.
- Several CodeMirror extensions each materialise the whole document per
  transaction: `codeBlocks.ts` `build()`, `codeHighlight.ts` `build()`,
  `imageView.ts` `build()` and `emphasis.ts` `buildUnderline()` all start with
  `state.doc.toString().includes(...)`, and `blocksIn()` walks every line.
- `fenceGuard` (a `transactionFilter` in `codeBlocks.ts`) calls `blocksIn` on
  the start document for edits **and** again on the new document for every
  selection change, so arrow keys and clicks scan the whole note.
- `underlineField` rebuilds on every selection change, re-running the regex
  over the full text.
- Direction: compute the fence/block list once per document version in a
  single `StateField` and share it across codeBlocks, codeHighlight, emphasis,
  imageView and fenceGuard; use `Text.iter`/`iterLines` or `sliceString` over
  changed ranges instead of `toString()`; map existing decorations through
  changes and rebuild only the affected region; scope selection-driven
  rebuilds to the spans the old and new selection touch. Defer pushing the
  body into the store (e.g. serialise on the debounce / `flush()` rather than
  per keystroke, or keep the `Text` and stringify lazily) while keeping the
  title, dirty state and autosave timing identical from the user's view.

### 3. Snippet highlighting re-parses blocks from scratch

- `codeHighlight.ts` caches parse trees keyed on the block's code
  (`TREE_LIMIT = 24`), and `detect.ts` memoises `detectCodeLanguage` on the
  full code string (`CACHE_LIMIT = 48`, cleared whole). Typing inside a block
  invalidates both, so each keystroke re-runs detection and a full parse of
  that block, and the header (`ToolsWidget`) re-detects too.
- Direction: reuse trees incrementally (`TreeFragment.applyChanges` +
  `parser.parse(input, fragments)`), keep detection stable while a block is
  being edited (debounce re-detection, or only re-detect when the block's
  signals could have changed), and make sure the header and the highlighter
  share one answer per block per version. Detection *results* must not change.

### 4. Startup bundle and critical path

- The initial chunk is ~596 KB minified. Find out what is in it (React,
  ReactDOM, CodeMirror core, autocomplete, search, app code) before deciding.
- `@codemirror/language` is both statically and dynamically imported, so the
  dynamic import in `editor.ts` buys nothing (Vite warns about this). Clean up
  so the lazy boundary is real.
- The markdown grammar is lazy but every note needs it, so it is on the
  critical path of the most common launch. Consider starting that import in
  parallel with `loadStore()` rather than after the first render.
- `autocompletion()` is mounted in every document; check what it costs and
  whether it does anything useful in a note.
- `main.tsx` wraps the app in `React.StrictMode` (dev-only double effects —
  harmless in release, but do not profile dev builds and draw conclusions).
- Fonts: `@fontsource-variable/geist` and `geist-mono` ship latin, latin-ext,
  cyrillic, cyrillic-ext, vietnamese and symbol subsets (~140 KB of woff2 in
  `dist`). They are `unicode-range` gated so only used subsets load, but
  measure whether importing only the needed subsets/axes (Geist Mono is used
  only for the `libellus` wordmark) reduces bundle and installer size. Fonts
  stay bundled locally.
- Check `vite.config.ts` `build.target` (`es2021`) against what WebView2 and
  WKWebView ship, and whether a newer target trims output.

### 5. Persistence

- `flush()` serialises **every** document with `JSON.stringify` on each
  debounced save, sends the whole string over IPC, and Rust does a full write
  plus `sync_all()`. Cost grows with the workspace, not with the edit.
- Direction (within the current one-file store): avoid serialising when
  nothing persisted changed (e.g. `activate`/`openDoc` currently schedule a full
  save for a tab switch), make sure saves never overlap, and measure the
  `fsync` cost. Do **not** start the SQLite migration here; if the numbers show
  the single-file store is the bottleneck, write up the case and the migration
  plan (versioned, reproducible) as a recommendation instead.
- Startup does `JSON.parse` of the whole store and sorts every doc; measure it
  on the large seed.

### 6. Images over IPC

- `save_image` / `load_image` move image bytes as base64 strings, and
  `src/lib/images.ts` keeps every decoded data URL in a `Map` for the session
  with no bound.
- Direction: pass raw bytes (Tauri 2 supports binary IPC payloads and
  `tauri::ipc::Response`) and build `blob:` URLs with `URL.createObjectURL`
  (check the CSP allows `blob:` for `img-src`; if not, propose the CSP change
  rather than making it), revoke URLs that are no longer referenced, and bound
  the cache. Do not use the asset protocol (that widens capabilities).

### 7. Search

- `searchDocs` in `src/lib/search.ts` lower-cases every title and body on every
  query keystroke, and the open palette sorts results a second time in
  `App.tsx` (`buildOpen`) after `searchDocs` already sorted them.
- Direction: keep a lower-cased index per doc that updates when a doc changes
  (not per query), drop the redundant sort, and consider an early cut-off once
  enough results are found. Ranking and excerpts must stay identical. SQLite
  FTS is the long-term answer; this is about not being wasteful until then.

### 8. Tab switching and idle

- `Editor.tsx` builds a brand-new `EditorState` with the full extension list
  on every tab switch, then reconfigures the language compartment after an
  async load (a visible flash of unhighlighted text is possible). Consider
  caching `EditorState` per open tab (it also preserves undo history and
  scroll, which is behaviour — check with the spec before keeping that side
  effect, and keep "undo never crosses documents").
- `TabBar.tsx` drag uses `mousemove` + `requestAnimationFrame` and
  `getBoundingClientRect` per frame; confirm the rAF loop stops when the drag
  ends and that layout reads are not interleaved with writes.
- Confirm no timer, interval, animation or listener runs while idle
  (`savedTimer`, `saveTimer`, palette/menu listeners, CSS animations).

### 9. Rust shell

- `Cargo.toml` already has a lean release profile (`lto`, `opt-level = "s"`,
  `codegen-units = 1`, `panic = "abort"`, `strip`). Check whether `tauri` default
  features pull in anything unused, and whether `tauri-plugin-dialog` (only used
  by Save As) is worth keeping vs. its size. Measure installer size before and
  after any change.
- `store_path`/`images_dir` call `create_dir_all` on every command; trivial,
  but resolve the directory once at startup if it shows up in timings.

## Out of scope

- Visual or interaction redesign, styling, the rounded-corner restyle.
- New features, the secrets feature, the SQLite migration itself.
- Replacing React, CodeMirror, Zustand or Tauri.
- Adding a test framework as a side effect (a small benchmark script is fine).

## Deliverables

1. A short `PERFORMANCE.md` (or a section in `README.md`) with the benchmark
   setup, the baseline numbers, the numbers after, and how to re-run it.
2. Small, focused commits — one optimisation each — with a message stating
   what was measured and what improved.
3. A pull request whose description has a before/after table per target and
   lists anything you investigated and deliberately did not change, with the
   reason.
4. A list of recommendations that need a decision (CSP or capability changes,
   the SQLite migration, dropping a dependency), each with its measured
   benefit.

Work in this order unless the baseline says otherwise: (1) re-render scope,
(2) per-keystroke editor work, (3) startup bundle, (4) persistence and images,
(5) search, (6) tab switching and idle, (7) Rust and installer size.
