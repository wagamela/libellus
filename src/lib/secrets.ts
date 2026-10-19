/**
 * Secret values go to the OS credential store through the Rust commands and
 * never into the workspace store. There is no secure storage in a plain
 * browser, so outside the desktop app secrets are simply unavailable rather
 * than falling back to localStorage.
 *
 * Callers must not log what these return or what they are given.
 */

export function secretsAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function call<T>(command: string, args: Record<string, string>): Promise<T> {
  if (!secretsAvailable()) throw new Error("secrets need the desktop app");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

export function writeSecret(id: string, value: string): Promise<void> {
  return call("set_secret", { id, value });
}

export function readSecret(id: string): Promise<string | null> {
  return call("get_secret", { id });
}

export function eraseSecret(id: string): Promise<void> {
  return call("delete_secret", { id });
}

/** Copies in the backend, so the value never reaches the webview. Resolves to
 *  the number of seconds until the clipboard is cleared again. */
export function copySecret(id: string): Promise<number> {
  return call("copy_secret", { id });
}
