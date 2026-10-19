import { emptyStore, type Store } from "./types";

// Named after the first store version and kept: renaming it would strand the
// browser fallback's existing data.
const LOCAL_KEY = "libellus.store.v1";

/** Each step lifts a store one version. Steps are only ever appended. */
const MIGRATIONS: Record<number, (store: any) => any> = {
  // v2 adds secret metadata; a v1 store had no secrets.
  1: (store) => ({ ...store, version: 2, secrets: [] }),
};

function migrate(store: any): Store | null {
  while (store && store.version !== emptyStore.version) {
    const step = MIGRATIONS[store.version];
    if (!step) return null;
    store = step(store);
  }
  return store;
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Persistence is deliberately thin for the MVP: one JSON document, read and
 * written whole. Inside Tauri it lives in the OS app-data directory; in a plain
 * browser (`npm run dev` without the shell) it falls back to localStorage.
 * SQLite replaces this layer later without the UI noticing.
 */
export async function loadStore(): Promise<Store> {
  try {
    const raw = inTauri()
      ? await (await import("@tauri-apps/api/core")).invoke<string | null>("load_store")
      : window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...emptyStore };
    const parsed = migrate(JSON.parse(raw));
    if (!parsed || !Array.isArray(parsed.docs) || !Array.isArray(parsed.secrets)) {
      return { ...emptyStore };
    }
    return parsed;
  } catch {
    // A missing or unreadable store must never block startup.
    return { ...emptyStore };
  }
}

export async function saveStore(store: Store): Promise<void> {
  const raw = JSON.stringify(store);
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_store", { contents: raw });
  } else {
    window.localStorage.setItem(LOCAL_KEY, raw);
  }
}
