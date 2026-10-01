# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

libellus is a local-first desktop developer workspace (notes, snippets, later secrets and
utilities) built as a Tauri 2 app: React 18 + TypeScript + Vite 6 + Tailwind 4 frontend,
thin Rust backend. The repository holds the **v0.1 MVP** — the workspace shell and editor.

- `project_spec.md` — full product scope and non-negotiable constraints.
- `design.md` — the design system ("minimal dark developer workstation").
- `README.md` — what works today, what is deferred, and the keybinding table.

Read the relevant spec/design section before adding UI or storage behaviour; both documents
describe decisions that are intentional, not provisional.

## Commands

```bash
npm install
npm run dev        # frontend only, browser at http://localhost:1420 (no Rust needed)
npm run app        # full desktop app — runs `npm run dev` itself via beforeDevCommand
npm run build      # tsc --noEmit + vite build (this is the typecheck)
npm run app:build  # bundle NSIS + MSI installers
```

There is no test runner, linter, or test suite configured. `npm run build` is the only
automated check; run it after TypeScript changes. For Rust changes, `cargo check` inside
`src-tauri/`.

Do not start `npm run dev` and `npm run app` at the same time — port 1420 is `strictPort`.

## Architecture

**One store, one save path.** The entire workspace is a single versioned JSON document
(`Store` in `src/lib/types.ts`). `src/lib/storage.ts` is the only module that knows where it
lives: inside Tauri it calls the `load_store` / `save_store` commands; in a plain browser it
falls back to `localStorage`. The Rust side (`src-tauri/src/lib.rs`) writes `store.json` in
the OS app-data directory via write-temp-then-rename, so an interrupted save cannot truncate
an existing store. SQLite is meant to replace this layer later without the UI noticing —
keep persistence knowledge out of components, and bump `Store.version` with a migration path
rather than changing the shape in place.

**Zustand store owns all mutations.** `src/store/workspace.ts` holds docs, tab order, dirty
set and save status, and every mutation goes through it. Writes are debounced (~900 ms) into
`flush()`; `Ctrl S`, delete and `beforeunload` call `flush()` directly. Components never
touch `storage.ts`. Note the `autoTitle` rule: a document's title tracks the first
meaningful line of its body until the user renames it by hand, which clears the flag.

**App.tsx is the keyboard and command hub.** Global shortcuts, the menu definitions and both
command-palette modes (commands via `Ctrl K`, quick open via `Ctrl P`) are all assembled
there from the same callbacks, so a new command belongs in all three lists. In-document find
is delegated to CodeMirror by dispatching a synthetic `Ctrl F` at `.cm-content`.

**Editor.** CodeMirror 6. `src/lib/editor.ts` holds the theme and highlight style and loads
language grammars on demand via dynamic `import()` — keep new languages lazy so they stay out
of the startup bundle. Add the language to `Language`/`LANGUAGES` in `types.ts` as well, and to
`CODE_LANGUAGES` in `editor.ts` if a fenced code block should be able to use it.

**Rich content is plain text.** Images (`src/lib/images.ts`, `src/lib/imageView.ts`) and code
snippet areas (`src/lib/codeBlocks.ts`) add no fields to `Doc`: an image is a
`![](libellus:name)` reference and a code block is an ordinary ``` fence. The editor decorates
those spans, so the body stays markdown that saves out and searches as written, and nothing
about this needs a store migration. Keep anything in this family the same way — a decoration
over text the user could have typed, never a new shape in the document model.

**Search.** `src/lib/search.ts` is an in-memory subsequence ranker over titles and bodies,
deliberately simple until SQLite FTS replaces it.

## Conventions

- Design tokens live in `@theme` in `src/styles.css` (`bg-workspace`, `text-dim`,
  `bg-surface`, …). Use the token classes; do not introduce raw hex colours in components.
- There are no separator lines anywhere — no borders between regions, around panels, inputs
  or menus, and no rules inside menus. Sections, buttons and components are separated only by
  small differences between the surface tokens (and by spacing). There are deliberately no
  `--color-line` tokens to reach for; do not add borders back.
- The palette is deliberately achromatic: dark blue-grey surfaces, white content, and a
  near-white `--color-accent`. Emphasis comes from brightness, never hue — that includes
  syntax highlighting and error states. Do not add a coloured accent or semantic hues.
- The UI is set in Geist (sans) throughout and lowercase in most labels; the only Geist Mono
  in the app is the `libellus` wordmark in the top-right of the menu bar; it should read as a native
  desktop tool, not a web page.
- The CSP in `tauri.conf.json` allows only self, inline styles, data images and data fonts.
  No network requests, no accounts, no telemetry — fonts and assets must be bundled, never
  fetched from a CDN.
- Tauri permissions stay minimal: `core:default` only. Storage goes through the two libellus
  commands rather than filesystem scopes; widen `src-tauri/capabilities/default.json` only
  when there is no alternative.

## Constraints from the spec

When the secrets feature lands: secrets must never be plaintext database fields, use
platform-native secure storage and established crypto libraries (never custom cryptography),
and sensitive values must never reach logs, error messages or console output. Clipboard
copies of secrets are a sensitive operation (clearing, warnings).

Database migrations must be versioned and reproducible.
