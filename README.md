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
- Titles derived from the first line until a document is renamed by hand
- Command palette (`Ctrl K`) and quick open with local search over titles and
  bodies (`Ctrl P`)
- Autosave with explicit `Ctrl S`, and modified / saving / saved states
- Persistence in the OS app-data directory via an atomic write, with a
  localStorage fallback when the frontend runs in a plain browser
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
| Find in document | `Ctrl F`       |
| Close tab        | `Ctrl W`       |
| Next tab         | `Ctrl Tab`     |

## Layout

```text
src/
  components/   MenuBar, TabBar, DocHeader, Editor, CommandPalette, StatusBar
  lib/          types, storage, search, editor theme and lazy language loading
  store/        zustand workspace store (documents, tabs, autosave)
src-tauri/      Rust shell; load_store / save_store commands
```
