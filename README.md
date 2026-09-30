# libellus

A lightweight, local-first developer workspace: notes, snippets and (later)
secrets and utilities in one persistent, keyboard-driven window.

This repository currently holds the **v0.1 MVP**, which covers the workspace
shell and the editor. See `project_spec.md` for the full product scope and
`design.md` for the design system.

## What works today

- Tauri 2 desktop shell (React + TypeScript + Vite + Tailwind 4)
- Tab-based workspace with an application menu and a status bar
- CodeMirror 6 editor — markdown for notes, syntax highlighting for snippets
  (TypeScript, JavaScript, JSON, Python, Rust, SQL, plain text)
- Opens straight into the document you last worked on (a fresh note on a first
  run), with the caret already in the editor — there is no landing page
- Named tabs: a new document opens straight into its rename field, and any tab
  can be renamed later by double-clicking it, right-clicking it, or `F2`. A
  name left empty hands the tab back to the first line of the document
- Command palette (`Ctrl K`) and quick open with local search over titles and
  bodies (`Ctrl P`). Each quick-open row carries a delete control (`Ctrl D` on
  the highlighted row): it arms on the first press and deletes on the second,
  and the palette stays open so several documents can be cleared in one pass
- Paste (or drop) images into a document: each is stored as a file beside the
  workspace and drawn in place of its reference, wherever the caret is — one
  to a line, or several side by side
- Tabs are sorted by hand: drag one along the strip and the others part around
  it, or move the active tab with `Ctrl Shift PageUp` / `Ctrl Shift PageDown`.
  The order is part of the workspace and comes back on the next launch
- Closing a tab is undoable: `Ctrl Shift T` reopens the most recently closed
  tab in the position it held, up to twenty closes back within a session
- Autosave with explicit `Ctrl S`, and modified / saving / saved states
- `Save As` (`Ctrl Shift S`, also in the File menu and the command palette):
  writes a copy of the open document anywhere on disk through a native file
  dialog, named after its title and the language's extension
- Persistence in the OS app-data directory via an atomic write, with a
  localStorage fallback when the frontend runs in a plain browser (pasted
  images sit in an `images/` directory next to the store, or in IndexedDB in
  the browser fallback)
- Fully offline: no network requests, no accounts, no telemetry

## Not in this version

Secrets, projects, developer utilities (JSON/Base64/UUID/JWT/…), tags and
SQLite FTS are specified but deliberately deferred. The storage layer is a
single versioned JSON document behind `src/lib/storage.ts`, so SQLite can
replace it without touching the UI.

## Running it

```bash
npm install
npm run dev      # frontend only, in a browser at http://localhost:1420
npm run app      # full desktop app (requires Rust)
npm run app:build
```

The desktop shell needs the Rust toolchain and, on Windows, the MSVC build
tools and WebView2. Install Rust from https://rustup.rs if `cargo` is missing;
`npm run dev` works without it.

## Keys

| Action           | Shortcut       |
| ---------------- | -------------- |
| Command palette  | `Ctrl K`       |
| Quick open       | `Ctrl P`       |
| New note         | `Ctrl N`       |
| New snippet      | `Ctrl Shift N` |
| Save             | `Ctrl S`       |
| Save as          | `Ctrl Shift S` |
| Find in document | `Ctrl F`       |
| Paste image      | `Ctrl V`       |
| Rename tab       | `F2`           |
| Close tab        | `Ctrl W`       |
| Reopen closed tab| `Ctrl Shift T` |
| Next tab         | `Ctrl Tab`     |
| Previous tab     | `Ctrl Shift Tab` |
| Move tab left    | `Ctrl Shift PageUp` |
| Move tab right   | `Ctrl Shift PageDown` |

## Layout

```text
src/
  components/   MenuBar, TabBar, Editor, CommandPalette, StatusBar
  lib/          types, storage, images, files, search, editor theme and lazy
                language loading
  store/        zustand workspace store (documents, tabs, autosave)
src-tauri/      Rust shell; load_store / save_store, the image commands and
                save_document_as
```
