import { useEffect, useRef, useState } from "react";
import type { Doc } from "../lib/types";
import { docLabel, useWorkspace } from "../store/workspace";

/** A row in the project column: a project, "no project" (id null), or the
 *  offer to create one from what was typed. */
interface Row {
  id: string | null;
  name: string;
  create?: true;
}

type Column = "projects" | "docs";

/**
 * Projects at a glance: the list on the left, and whatever the selected one
 * holds on the right, its open tabs first. Selecting a project here only
 * previews it; Enter or "make current" is what switches.
 */
export function ProjectsPanel({ onClose }: { onClose: () => void }) {
  const projects = useWorkspace((s) => s.projects);
  const activeProject = useWorkspace((s) => s.activeProject);
  const docs = useWorkspace((s) => s.docs);
  const openTabs = useWorkspace((s) => s.openTabs);
  const activeTab = useWorkspace((s) => s.activeTab);
  const secrets = useWorkspace((s) => s.secrets);
  const { createProject, renameProject, deleteProject, setActiveProject, openDoc, closeTab } =
    useWorkspace.getState();

  const [query, setQuery] = useState("");
  const [column, setColumn] = useState<Column>("projects");
  const [selected, setSelected] = useState<string | null>(activeProject);
  const [docCursor, setDocCursor] = useState(0);
  const [armed, setArmed] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const name = query.trim();
  const q = name.toLowerCase();
  const rows: Row[] = [
    { id: null, name: "no project" },
    ...[...projects].sort((a, b) => a.name.localeCompare(b.name)),
  ].filter((row) => row.name.toLowerCase().includes(q));
  if (name && !projects.some((p) => p.name.toLowerCase() === q)) {
    rows.push({ id: "create", name, create: true });
  }
  // The selection follows the filter: if the selected row was filtered out,
  // the first row that is left takes its place.
  const cursor = Math.max(
    0,
    rows.findIndex((row) => (row.create ? "create" : row.id) === selected),
  );
  const row = rows[cursor] as Row | undefined;
  const project = row && !row.create && row.id ? projects.find((p) => p.id === row.id) : undefined;

  const inRow = (doc: Doc) => doc.projectId === (row?.id ?? null);
  const open = row?.create ? [] : openTabs.map((id) => docs[id]).filter((d) => d && inRow(d));
  const rest = row?.create
    ? []
    : Object.values(docs)
        .filter((d) => inRow(d) && !openTabs.includes(d.id))
        .sort((a, b) => b.updatedAt - a.updatedAt);
  const list = [...open, ...rest];
  const secretCount = secrets.filter((s) => s.projectId === (row?.id ?? null)).length;

  useEffect(() => {
    setArmed(false);
  }, [cursor, query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [docCursor, column]);

  const select = (index: number) => {
    const next = rows[Math.max(0, Math.min(index, rows.length - 1))];
    if (next) setSelected(next.create ? "create" : next.id);
    setDocCursor(0);
  };

  const refocus = () => requestAnimationFrame(() => input.current?.focus());

  const create = () => {
    const id = createProject(name);
    setQuery("");
    setSelected(id);
  };

  const makeCurrent = () => {
    if (!row) return;
    if (row.create) create();
    else setActiveProject(row.id);
  };

  const remove = () => {
    if (!project) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    // Only the grouping goes: its documents and secrets are kept.
    deleteProject(project.id);
    setSelected(null);
    setArmed(false);
  };

  const openAt = (doc: Doc | undefined) => {
    if (!doc) return;
    onClose();
    openDoc(doc.id);
  };

  const endRename = (value: string | null) => {
    if (renaming && value !== null) renameProject(renaming, value);
    setRenaming(null);
    refocus();
  };

  const action =
    "rounded-sm px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface hover:text-text active:bg-pressed";

  return (
    <div
      className="fixed inset-0 z-100 flex justify-center bg-black/45 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className="flex h-fit w-[min(860px,94vw)] flex-col overflow-hidden rounded-xl bg-chrome shadow-[0_16px_48px_#00000080]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={input}
          autoFocus
          spellCheck={false}
          value={query}
          placeholder="find a project, or type a name to create one…"
          onChange={(event) => {
            setQuery(event.target.value);
            setColumn("projects");
          }}
          onKeyDown={(event) => {
            const docs = column === "docs";
            if (event.key === "Escape") {
              event.stopPropagation();
              if (docs) setColumn("projects");
              else onClose();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const delta = event.key === "ArrowDown" ? 1 : -1;
              if (docs) setDocCursor((c) => Math.max(0, Math.min(c + delta, list.length - 1)));
              else select(cursor + delta);
            } else if (event.key === "Tab") {
              // Tab crosses between the two columns; there is nowhere else
              // inside the panel for focus to go.
              event.preventDefault();
              if (!docs && list.length > 0) setColumn("docs");
              else setColumn("projects");
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (docs) {
                openAt(list[docCursor]);
              } else if (row?.create) {
                create();
              } else if (row) {
                setActiveProject(row.id);
                onClose();
              }
            } else if (event.key === "F2" && project) {
              event.preventDefault();
              event.stopPropagation();
              setRenaming(project.id);
            } else if (event.key.toLowerCase() === "d" && event.ctrlKey) {
              event.preventDefault();
              remove();
            }
          }}
          className="w-full bg-surface px-4 py-3 text-[13px] text-text outline-none placeholder:text-muted"
        />
        <div className="flex h-[52vh] min-h-0">
          <div className="w-[260px] shrink-0 overflow-y-auto p-1.5">
            {rows.map((r, index) => {
              const count = Object.values(docs).filter((d) => d.projectId === r.id).length;
              const current = !r.create && r.id === activeProject;
              const chosen = index === cursor;
              return (
                <div
                  key={r.create ? "create" : r.id ?? "none"}
                  onMouseDown={(event) => {
                    // Keeps the caret in the query field, so the keys go on working.
                    if (renaming !== r.id) event.preventDefault();
                  }}
                  onClick={() => {
                    select(index);
                    setColumn("projects");
                  }}
                  onDoubleClick={() => !r.create && r.id && setRenaming(r.id)}
                  className={`flex cursor-default items-baseline gap-3 rounded-md px-2.5 py-[6px] ${
                    chosen ? (column === "projects" ? "bg-raised" : "bg-surface") : ""
                  }`}
                >
                  {renaming !== null && renaming === r.id ? (
                    <RenameField initial={r.name} onEnd={endRename} />
                  ) : (
                    <span
                      className={`min-w-0 flex-1 truncate text-[12px] ${
                        r.id === null && !r.create ? "text-dim" : "text-text"
                      }`}
                    >
                      {r.create ? `create project: ${r.name}` : r.name}
                    </span>
                  )}
                  {!r.create && (
                    <span className={`shrink-0 text-[11px] ${current ? "text-dim" : "text-muted"}`}>
                      {current ? "current" : count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex min-w-0 flex-1 flex-col bg-surface">
            {row && !row.create && (
              <div className="flex shrink-0 items-center gap-1 px-4 pt-3 pb-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-dim">
                  {list.length} {list.length === 1 ? "document" : "documents"} · {open.length} open
                  {" · "}
                  {secretCount} {secretCount === 1 ? "secret" : "secrets"}
                </span>
                <button
                  className={`${action} ${row.id === activeProject ? "invisible" : ""}`}
                  onClick={() => {
                    makeCurrent();
                    refocus();
                  }}
                >
                  make current
                </button>
                {project && (
                  <>
                    <button className={action} title="rename (F2)" onClick={() => setRenaming(project.id)}>
                      rename
                    </button>
                    <button
                      className={`${action} ${armed ? "bg-raised text-text" : ""}`}
                      title="delete project, keeping its documents and secrets (Ctrl D)"
                      onClick={() => {
                        remove();
                        refocus();
                      }}
                    >
                      {armed ? "delete? contents are kept" : "delete"}
                    </button>
                  </>
                )}
              </div>
            )}
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
              {row?.create && (
                <div className="px-2.5 py-3 text-[12px] text-muted">
                  Enter creates {row.name} and makes it the current project
                </div>
              )}
              {row && !row.create && list.length === 0 && (
                <div className="px-2.5 py-3 text-[12px] text-muted">no documents here yet</div>
              )}
              {list.map((doc, index) => {
                const isOpen = index < open.length;
                const chosen = column === "docs" && index === docCursor;
                return (
                  <div key={doc.id}>
                    {(index === 0 || index === open.length) && (
                      <div className="px-2.5 pt-2.5 pb-1 text-[11px] text-muted first:pt-1">
                        {isOpen ? "open tabs" : "other documents"}
                      </div>
                    )}
                    <div
                      data-active={chosen}
                      onMouseDown={(event) => event.preventDefault()}
                      className={`group flex items-baseline gap-3 rounded-md px-2.5 py-[6px] hover:bg-raised ${
                        chosen ? "bg-raised" : ""
                      }`}
                    >
                      <button
                        onClick={() => openAt(doc)}
                        className="min-w-0 flex-1 truncate text-left text-[12px] text-text active:opacity-70"
                      >
                        {docLabel(doc)}
                      </button>
                      <span className="shrink-0 text-[11px] text-muted">
                        {doc.id === activeTab ? "active · " : ""}
                        {doc.kind === "note" ? "note" : doc.language}
                      </span>
                      {isOpen && (
                        <button
                          aria-label={`close ${docLabel(doc)}`}
                          onClick={() => closeTab(doc.id)}
                          className={`-my-1 self-center ${action} ${
                            chosen ? "" : "invisible group-hover:visible"
                          }`}
                        >
                          close
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-4 px-4 py-2 text-[11px] text-muted">
          <span>↑↓ select</span>
          <span>Enter {column === "docs" ? "open" : "switch"}</span>
          <span>Tab {column === "docs" ? "projects" : "documents"}</span>
          <span>F2 rename</span>
          <span>Ctrl D delete</span>
        </div>
      </div>
    </div>
  );
}

/** The project name while it is edited. Enter or blur commits, Escape
 *  abandons; an empty name keeps the old one. */
function RenameField({ initial, onEnd }: { initial: string; onEnd: (value: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const settled = useRef(false);
  const end = (next: string | null) => {
    if (settled.current) return;
    settled.current = true;
    onEnd(next);
  };
  return (
    <input
      autoFocus
      spellCheck={false}
      value={value}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => end(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") end(value);
        if (event.key === "Escape") end(null);
      }}
      className="min-w-0 flex-1 rounded-sm bg-surface px-1 text-[12px] text-text outline-none"
    />
  );
}
