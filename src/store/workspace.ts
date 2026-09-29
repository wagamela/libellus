import { create } from "zustand";
import { loadStore, saveStore } from "../lib/storage";
import { saveDocumentAs } from "../lib/files";
import { IMAGE_REF, deleteImage, imageRefs } from "../lib/images";
import { newId, type Doc, type DocKind, type Language } from "../lib/types";

export type SaveStatus = "idle" | "modified" | "saving" | "saved" | "error";

/** A tab that was closed, remembered well enough to put it back where it was. */
interface ClosedTab {
  id: string;
  index: number;
}

interface WorkspaceState {
  docs: Record<string, Doc>;
  order: string[];
  openTabs: string[];
  activeTab: string | null;
  dirty: Set<string>;
  status: SaveStatus;
  ready: boolean;
  /** Most recently closed last: `reopenTab` pops from the end. */
  closedTabs: ClosedTab[];

  init: () => Promise<void>;
  createDoc: (kind: DocKind, seed?: Partial<Doc>) => string;
  openDoc: (id: string) => void;
  closeTab: (id: string) => void;
  reopenTab: () => void;
  activate: (id: string) => void;
  cycleTab: (delta: number) => void;
  updateBody: (id: string, body: string) => void;
  rename: (id: string, title: string) => void;
  setLanguage: (id: string, language: Language) => void;
  deleteDoc: (id: string) => void;
  flush: () => Promise<void>;
  saveAs: (id: string) => Promise<void>;
}

const DEFAULT_LANGUAGE: Record<DocKind, Language> = {
  note: "markdown",
  snippet: "typescript",
};

/** How far back Ctrl+Shift+T can reach. Deep enough to undo a stray run of
 *  closes, shallow enough that it stays a recovery tool and not a history. */
const CLOSED_LIMIT = 20;

/** Turns the first meaningful line of a document into a tab-sized title. */
function deriveTitle(body: string, kind: DocKind): string {
  const line = body
    .split("\n")
    // An image reference is a picture, not a sentence: it never names the tab.
    .map((l) => l.replace(IMAGE_REF, "").replace(/^[\s#/*<!;-]+/, "").trim())
    .find((l) => l.length > 0);
  if (!line) return kind === "note" ? "untitled note" : "untitled snippet";
  return line.length > 60 ? `${line.slice(0, 60)}…` : line;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let savedTimer: ReturnType<typeof setTimeout> | undefined;

export const useWorkspace = create<WorkspaceState>((set, get) => {
  /** Debounced autosave. Explicit Ctrl+S goes through `flush` directly. */
  const schedule = () => {
    set({ status: "modified" });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().flush(), 900);
  };

  const touch = (id: string, patch: Partial<Doc>) => {
    const doc = get().docs[id];
    if (!doc) return;
    const dirty = new Set(get().dirty);
    dirty.add(id);
    set({
      docs: { ...get().docs, [id]: { ...doc, ...patch, updatedAt: Date.now() } },
      dirty,
    });
    schedule();
  };

  return {
    docs: {},
    order: [],
    openTabs: [],
    activeTab: null,
    dirty: new Set<string>(),
    status: "idle",
    ready: false,
    closedTabs: [],

    async init() {
      const store = await loadStore();
      const docs: Record<string, Doc> = {};
      for (const doc of store.docs) docs[doc.id] = doc;
      const order = [...store.docs]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((d) => d.id);
      const openTabs = store.openTabs.filter((id) => docs[id]);
      const restored =
        store.activeTab && docs[store.activeTab] ? store.activeTab : openTabs[0] ?? null;
      set({ docs, order, openTabs, activeTab: restored, ready: true });

      // There is no landing page: the window always opens on a document the
      // user can type into. Failing a restored tab, that is the most recently
      // edited document, and failing any document at all, a fresh note.
      if (restored) return;
      if (order.length > 0) get().openDoc(order[0]);
      else get().createDoc("note");
    },

    createDoc(kind, seed) {
      const id = newId();
      const now = Date.now();
      const doc: Doc = {
        id,
        kind,
        title: seed?.title ?? (kind === "note" ? "untitled note" : "untitled snippet"),
        language: seed?.language ?? DEFAULT_LANGUAGE[kind],
        body: seed?.body ?? "",
        autoTitle: seed?.autoTitle ?? true,
        createdAt: now,
        updatedAt: now,
      };
      const dirty = new Set(get().dirty);
      dirty.add(id);
      set({
        docs: { ...get().docs, [id]: doc },
        order: [id, ...get().order],
        openTabs: [...get().openTabs, id],
        activeTab: id,
        dirty,
      });
      schedule();
      return id;
    },

    openDoc(id) {
      if (!get().docs[id]) return;
      const openTabs = get().openTabs.includes(id)
        ? get().openTabs
        : [...get().openTabs, id];
      set({ openTabs, activeTab: id });
      schedule();
    },

    closeTab(id) {
      const { openTabs, activeTab, closedTabs } = get();
      const index = openTabs.indexOf(id);
      if (index === -1) return;
      const next = openTabs.filter((t) => t !== id);
      set({
        openTabs: next,
        activeTab:
          activeTab === id ? next[Math.min(index, next.length - 1)] ?? null : activeTab,
        // Closing a tab is the one destructive-feeling action that takes no
        // confirmation, so it is always undoable for the rest of the session.
        closedTabs: [...closedTabs.filter((c) => c.id !== id), { id, index }].slice(
          -CLOSED_LIMIT,
        ),
      });
      schedule();
    },

    reopenTab() {
      const { docs, openTabs, closedTabs } = get();
      const remaining = [...closedTabs];
      // Entries go stale: the document may have been deleted, or reopened by
      // hand. Skip past those rather than making the shortcut do nothing.
      while (remaining.length > 0) {
        const entry = remaining.pop()!;
        if (!docs[entry.id] || openTabs.includes(entry.id)) continue;
        const next = [...openTabs];
        next.splice(Math.min(entry.index, next.length), 0, entry.id);
        set({ openTabs: next, activeTab: entry.id, closedTabs: remaining });
        schedule();
        return;
      }
      set({ closedTabs: remaining });
    },

    activate(id) {
      set({ activeTab: id });
      schedule();
    },

    cycleTab(delta) {
      const { openTabs, activeTab } = get();
      if (openTabs.length === 0) return;
      const current = activeTab ? openTabs.indexOf(activeTab) : 0;
      const next = (current + delta + openTabs.length) % openTabs.length;
      set({ activeTab: openTabs[next] });
    },

    updateBody(id, body) {
      const doc = get().docs[id];
      if (!doc || doc.body === body) return;
      // The first line doubles as the title until the document is renamed.
      const patch: Partial<Doc> = { body };
      if (doc.autoTitle) patch.title = deriveTitle(body, doc.kind);
      touch(id, patch);
    },

    rename(id, title) {
      touch(id, { title: title.trim() || "untitled", autoTitle: false });
    },

    setLanguage(id, language) {
      touch(id, { language });
    },

    deleteDoc(id) {
      const docs = { ...get().docs };
      const doomed = docs[id];
      delete docs[id];
      // Images the rest of the workspace no longer refers to go with it,
      // otherwise the image directory only ever grows.
      if (doomed) {
        const kept = new Set(Object.values(docs).flatMap((d) => imageRefs(d.body)));
        for (const name of imageRefs(doomed.body)) {
          if (!kept.has(name)) void deleteImage(name);
        }
      }
      const openTabs = get().openTabs.filter((t) => t !== id);
      set({
        docs,
        order: get().order.filter((t) => t !== id),
        openTabs,
        activeTab: get().activeTab === id ? openTabs[openTabs.length - 1] ?? null : get().activeTab,
        // A deleted document must not come back through Ctrl+Shift+T.
        closedTabs: get().closedTabs.filter((c) => c.id !== id),
      });
      void get().flush();
    },

    /** A copy of the document, written wherever the user chooses. */
    async saveAs(id) {
      const doc = get().docs[id];
      if (!doc) return;
      // The workspace copy is committed first, so what lands on disk and what
      // is saved here can never disagree.
      await get().flush();
      try {
        await saveDocumentAs(doc);
      } catch {
        set({ status: "error" });
      }
    },

    async flush() {
      clearTimeout(saveTimer);
      const { docs, openTabs, activeTab } = get();
      set({ status: "saving" });
      try {
        await saveStore({
          version: 1,
          docs: Object.values(docs),
          openTabs,
          activeTab,
        });
        set({ dirty: new Set<string>(), status: "saved" });
        clearTimeout(savedTimer);
        savedTimer = setTimeout(() => {
          if (get().status === "saved") set({ status: "idle" });
        }, 1600);
      } catch {
        set({ status: "error" });
      }
    },
  };
});

export function docLabel(doc: Doc): string {
  return doc.title || (doc.kind === "note" ? "untitled note" : "untitled snippet");
}
