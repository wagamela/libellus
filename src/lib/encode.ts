/** Base64 over the text's UTF-8 bytes: `btoa` alone throws on anything
 *  outside Latin-1. */
export function encodeBase64(text: string): string {
  return btoa(Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join(""));
}

/** Throws when the input is not base64 or does not decode to UTF-8 text, so
 *  binary never lands in a document as mojibake. */
export function decodeBase64(text: string): string {
  const bytes = Uint8Array.from(atob(text.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
