import { LANGUAGE_EXTENSION, type Doc } from "./types";

/**
 * Saving a document out to the user's own filesystem, as opposed to the
 * workspace store. The native picker and the write both live in the Rust
 * command, so the frontend needs no filesystem scope and the app keeps its
 * `core:default` capability set. In a plain browser there is no picker, so a
 * download is the closest equivalent.
 */

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** A title is free text; a file name is not. */
export function suggestedFileName(doc: Doc): string {
  const extension = LANGUAGE_EXTENSION[doc.language] ?? "txt";
  const base =
    doc.title
      .replace(/[^A-Za-z0-9._ -]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.\s]+|[-\s]+$/g, "")
      .slice(0, 80)
      .trim() || "untitled";
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

/**
 * Writes a copy of the document wherever the user points the dialog. Resolves
 * to the chosen path, or null when the dialog was cancelled.
 */
export async function saveDocumentAs(doc: Doc): Promise<string | null> {
  const name = suggestedFileName(doc);
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string | null>("save_document_as", {
      name,
      extension: LANGUAGE_EXTENSION[doc.language] ?? "txt",
      contents: doc.body,
    });
  }

  const url = URL.createObjectURL(new Blob([doc.body], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  return name;
}
