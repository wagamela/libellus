import { emptyStore, type Store } from "./types";

const LOCAL_KEY = "libellus.store.v1";

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
    const parsed = JSON.parse(raw) as Store;
    if (parsed.version !== 1 || !Array.isArray(parsed.docs)) {
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
