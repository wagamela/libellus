import { newId } from "./types";

/**
 * Pasted images live beside the store, not in it. A document body only ever
 * holds a reference — `![alt](libellus:name.png)` — so the workspace JSON that
 * is rewritten on every debounced save stays small, and an image is read once
 * and then cached for the life of the session.
 *
 * Inside Tauri the bytes are files in the app-data `images/` directory; in a
 * plain browser (`npm run dev` without the shell) they go to IndexedDB, which
 * unlike localStorage is not a handful of megabytes of string quota.
 */

/** Matches an image reference anywhere in a document body. */
export const IMAGE_REF = /!\[[^\]\n]*\]\(libellus:([A-Za-z0-9._-]+)\)/g;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  svg: "image/svg+xml",
};

/** The reverse map, so a clipboard type picks the file extension. */
function extensionFor(type: string): string {
  const match = Object.entries(MIME).find(([, mime]) => mime === type);
  return match ? match[0] : "png";
}

function mimeFor(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Data URLs already decoded this session, keyed by image name. */
const cache = new Map<string, string>();
/** In-flight reads, so a document with the same image twice loads it once. */
const pending = new Map<string, Promise<string | null>>();

function toBase64(bytes: Uint8Array): string {
  // Chunked: `String.fromCharCode(...bytes)` blows the argument limit on
  // anything bigger than a small icon.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// --- browser fallback ------------------------------------------------------

const DB_NAME = "libellus.images";
const DB_STORE = "images";
let dbHandle: Promise<IDBDatabase> | undefined;

function db(): Promise<IDBDatabase> {
  dbHandle ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbHandle;
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (handle) =>
      new Promise<T>((resolve, reject) => {
        const request = run(handle.transaction(DB_STORE, mode).objectStore(DB_STORE));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

// --- api -------------------------------------------------------------------

/**
 * Writes image bytes and returns the reference name. The data URL is cached
 * before the write finishes, so the editor can render the paste immediately
 * instead of waiting on the disk.
 */
export async function putImage(bytes: Uint8Array, type: string): Promise<string> {
  const name = `img-${newId()}.${extensionFor(type)}`;
  const base64 = toBase64(bytes);
  cache.set(name, `data:${mimeFor(name)};base64,${base64}`);
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_image", { name, data: base64 });
  } else {
    await idb("readwrite", (store) => store.put(base64, name));
  }
  return name;
}

/** The data URL for a reference, or null when the file is gone. */
export function getImage(name: string): Promise<string | null> {
  const hit = cache.get(name);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(name);
  if (inFlight) return inFlight;

  const read = (async () => {
    try {
      const base64 = inTauri()
        ? await (await import("@tauri-apps/api/core")).invoke<string | null>("load_image", { name })
        : await idb<string | undefined>("readonly", (store) => store.get(name));
      if (!base64) return null;
      const url = `data:${mimeFor(name)};base64,${base64}`;
      cache.set(name, url);
      return url;
    } catch {
      // A missing or unreadable image is a blank frame, never a broken editor.
      return null;
    } finally {
      pending.delete(name);
    }
  })();
  pending.set(name, read);
  return read;
}

/** Synchronous peek, so an already-decoded image paints on the first frame. */
export function peekImage(name: string): string | undefined {
  return cache.get(name);
}

export async function deleteImage(name: string): Promise<void> {
  cache.delete(name);
  try {
    if (inTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_image", { name });
    } else {
      await idb("readwrite", (store) => store.delete(name));
    }
  } catch {
    // Losing the file is not worth failing the delete that triggered it.
  }
}

/** Every image a document body refers to. */
export function imageRefs(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(IMAGE_REF)) names.add(match[1]);
  return [...names];
}

/** Pulls image files out of a clipboard or drop payload. */
export function imagesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return [...data.files].filter((file) => file.type.startsWith("image/"));
}
