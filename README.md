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
  (TypeScript, JavaScript, JSON, HTML, Python, Rust, C++, C#, SQL, plain text)
- Opens straight into the document you last worked on (a fresh note on a first
  run), with the caret already in the editor — there is no landing page
- Named tabs: a new document opens straight into its rename field, and any tab
  can be renamed later by double-clicking it, right-clicking it, or `F2`. A
  name left empty hands the tab back to the first line of the document
- Command palette (`Ctrl K`) and quick open with local search over titles and
  bodies (`Ctrl P`). Each quick-open row carries a delete control (`Ctrl D` on
  the highlighted row): it arms on the first press and deletes on the second,
  and the palette stays open so several documents can be cleared in one pass
- Code snippet areas inside any document (`Ctrl Alt C`): opens a fenced block
  with the caret inside it, or wraps the selected lines in one. The block is
  drawn as its own surface and the document itself stays plain markdown text
- A block works out its own language. Nothing is declared and nothing is set
  by hand: the code is read, recognised, and coloured in whatever it turned out
  to be — TypeScript, JavaScript, Python, Rust, C++, C#, SQL, JSON or HTML.
  Code that is not recognised confidently stays plain rather than being
  coloured as a guess, and a language with no grammar here (Java, say) is
  declined rather than labelled as the nearest thing
- The block's header says what it found on the right, beside the `copy` control
  that copies the code alone. The field on the left is the snippet's own title
  or a note on what it is for — it is yours to write and has no effect on the
  highlighting
- Code is the one place in libellus that carries colour. Keywords, strings,
  numbers, types, the things that are called and the names being defined each
  take a hue of their own — few and desaturated, with names and punctuation left
  grey — so the shape of a snippet reads at a glance. It stops at the edge of the
  code: prose, chrome, tabs and menus stay achromatic
- Bold, italic and underlined prose in a note (`Ctrl B` / `Ctrl I` / `Ctrl U`,
  also in the Edit menu and the command palette). Each is a toggle: it wraps
  the selection, or unwraps again when the caret is already inside a span. What
  it writes is markdown — `**bold**`, `*italic*` and, since markdown has no
  underline of its own, `<u>underlined</u>` — so the document still saves out
  and searches as written
- You do not see the markers. Bold reads as bold and the asterisks are not
  drawn at all; they reappear, dimmed, the moment the selection touches the
  span, so the markup can still be edited by hand and no text is ever hidden
  where the caret could walk into it blind. Which asterisks are markup is the
  markdown parser's answer, not a guess: `2 * 3 * 4`, a `* bullet` list and
  anything inside code keep their asterisks. Snippets are code all the way
  through and take none of this, and neither does a code block inside a note
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
| Bold             | `Ctrl B`       |
| Italic           | `Ctrl I`       |
| Underline        | `Ctrl U`       |
| Insert code block| `Ctrl Alt C`   |
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
  lib/          types, storage, images, code blocks, snippet language
                detection and highlighting, prose emphasis, files, search,
                editor theme and lazy language loading
  store/        zustand workspace store (documents, tabs, autosave)
src-tauri/      Rust shell; load_store / save_store, the image commands and
                save_document_as
```
