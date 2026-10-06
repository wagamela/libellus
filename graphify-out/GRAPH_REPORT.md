# Graph Report - libellus  (2026-10-06)

## Corpus Check
- 37 files · ~74,928 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .icns 1, .ico 1)

## Summary
- 412 nodes · 681 edges · 20 communities (15 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.88)
- Token cost: 85,741 input · 0 output

## Community Hubs (Navigation)
- Lazy Language Grammars
- Store, Save Path and Search
- Command Hub and Menu Surface
- Snippet Language Detection
- Images as Plain Text
- Fenced Code Block Decorations
- Tauri Shell and Project Identity
- Local-First Privacy Constraints
- Runtime Dependencies
- Rust Storage Commands
- TypeScript Compiler Config
- Hidden Emphasis Markers
- Achromatic Design Tokens
- Build Tooling Dependencies
- NPM Script Commands
- Command Palette Over Chrome
- Package Identity

## God Nodes (most connected - your core abstractions)
1. `App()` - 16 edges
2. `compilerOptions` - 16 edges
3. `loadLanguage()` - 14 edges
4. `loadParser()` - 12 edges
5. `blocksIn()` - 11 edges
6. `Doc` - 11 edges
7. `putImage()` - 10 edges
8. `react` - 8 edges
9. `scripts` - 7 edges
10. `@codemirror/state` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Minimal Tauri permissions and strict CSP` --references--> `load_store()`  [EXTRACTED]
  CLAUDE.md → src-tauri/src/lib.rs
- `Lazy grammar loading` --rationale_for--> `loadLanguage()`  [EXTRACTED]
  CLAUDE.md → src/lib/editor.ts
- `One store, one save path` --references--> `Store`  [EXTRACTED]
  CLAUDE.md → src/lib/types.ts
- `Versioned, reproducible database migrations` --rationale_for--> `Store`  [INFERRED]
  project_spec.md → src/lib/types.ts
- `Save As via native dialog` --references--> `save_document_as()`  [EXTRACTED]
  README.md → src-tauri/src/lib.rs

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Snippet language recognition and colouring flow** — src_lib_codeblocks, src_lib_detect, src_lib_codehighlight, src_lib_editor_loadparser, src_lib_editor_token_styles [EXTRACTED 1.00]
- **Single save path persistence chain** — src_store_workspace, src_store_workspace_flush, src_lib_storage, src_tauri_src_lib_save_store, src_lib_types_store [EXTRACTED 1.00]
- **Decoration-over-plain-text family** — src_lib_images, src_lib_imageview, src_lib_codeblocks, src_lib_emphasis, claude_rich_content_is_plain_text [EXTRACTED 1.00]

## Communities (20 total, 5 thin omitted)

### Community 0 - "Lazy Language Grammars"
Cohesion: 0.06
Nodes (38): name, private, type, version, CodeMirror 6 editor, Notes feature area, @codemirror/autocomplete, @codemirror/commands (+30 more)

### Community 1 - "Store, Save Path and Search"
Cohesion: 0.07
Nodes (34): Deliberate interface states, Search, Zustand state management, Hand-sorted persistent tab order, Undoable tab close, zustand, EditorProps, countLines() (+26 more)

### Community 2 - "Command Hub and Menu Surface"
Cohesion: 0.09
Nodes (31): Tabs as persistent workspace, index.html root mount point, Keybinding table, react, react-dom, App(), contextFor, PaletteMode (+23 more)

### Community 3 - "Snippet Language Detection"
Cohesion: 0.07
Nodes (28): @lezer/highlight, announceGrammar(), build(), grammarArrived, libellusCodeHighlight, loading, parserFor(), parsers (+20 more)

### Community 4 - "Images as Plain Text"
Cohesion: 0.11
Nodes (23): @codemirror/state, @codemirror/view, @tauri-apps/api, cache, db(), deleteImage(), extensionFor(), getImage() (+15 more)

### Community 5 - "Fenced Code Block Decorations"
Cohesion: 0.10
Nodes (18): Code snippets feature area, blockAt(), blocksIn(), build(), cleanFenceInfo(), CodeBlock, codeBlockField, fenceEdit (+10 more)

### Community 6 - "Tauri Shell and Project Identity"
Cohesion: 0.08
Nodes (25): graphify skill registration, libellus (project), Design anti-patterns, designidea.png visual reference, MVP definition, React + TypeScript + Vite frontend, Tauri 2 desktop runtime, v0.1 MVP scope (+17 more)

### Community 7 - "Local-First Privacy Constraints"
Cohesion: 0.07
Nodes (15): Secrets visual treatment (mask, reveal, copy, confirm), Utilities inside the same workspace system, Developer tools (JSON, Base64, UUID, JWT, …), Tool model (metadata, input, processing, output), Projects and organization, Secrets feature area, SQLite local database, SQLite FTS5 full-text search (+7 more)

### Community 8 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (23): dependencies, @codemirror/autocomplete, @codemirror/commands, @codemirror/lang-cpp, @codemirror/lang-html, @codemirror/lang-javascript, @codemirror/lang-json, @codemirror/lang-markdown (+15 more)

### Community 9 - "Rust Storage Commands"
Cohesion: 0.17
Nodes (10): Save As via native dialog, delete_image(), image_path(), images_dir(), load_image(), load_store(), save_document_as(), save_image() (+2 more)

### Community 10 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 11 - "Hidden Emphasis Markers"
Cohesion: 0.15
Nodes (14): buildUnderline(), Emphasis, emphasisMarks(), emphasisPlugin, HIDDEN, libellusEmphasis, MARKERS, SHOWN (+6 more)

### Community 12 - "Achromatic Design Tokens"
Cohesion: 0.15
Nodes (6): Radius scale (--radius-xs … --radius-xl), Surface ramp (chrome / tab / workspace / content), Tailwind CSS styling, Technical constraints, TOKEN_STYLES, src/styles.css

### Community 13 - "Build Tooling Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, tailwindcss, @tailwindcss/vite, @tauri-apps/cli, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 14 - "NPM Script Commands"
Cohesion: 0.29
Nodes (7): scripts, app, app:build, build, dev, preview, tauri

## Knowledge Gaps
- **146 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 197 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SQLite local database` connect `Local-First Privacy Constraints` to `Store, Save Path and Search`, `Tauri Shell and Project Identity`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Lazy Language Grammars` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Why does `MVP definition` connect `Tauri Shell and Project Identity` to `Local-First Privacy Constraints`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Should `Store, Save Path and Search` be split into smaller, more focused modules?**
  _Cohesion score 0.07246376811594203 - nodes in this community are weakly interconnected._
- **Why does `SQLite FTS5 full-text search` connect `Local-First Privacy Constraints` to `Store, Save Path and Search`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **Should `Command Hub and Menu Surface` be split into smaller, more focused modules?**
  _Cohesion score 0.09059233449477352 - nodes in this community are weakly interconnected._