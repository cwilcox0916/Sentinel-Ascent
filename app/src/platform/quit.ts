/**
 * Platform-aware quit handler.
 *
 * - Tauri desktop: calls the window API to close the current window cleanly.
 *   Autosaves should have flushed via the existing `visibilitychange` listener
 *   before the window closes.
 * - Web (PWA / regular tab): `window.close()` only works on tabs opened by
 *   script, so we fall back to a visible notice. In practice browsers block any
 *   in-page Quit and the user closes the tab via the chrome.
 */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    || !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export async function quitApplication(): Promise<void> {
  if (!isTauri()) {
    // Browser tab: best-effort close; most browsers block this and ignore.
    window.close();
    return;
  }
  try {
    // Dynamic import so the web bundle doesn't pull in the Tauri API.
    const mod = await import(/* @vite-ignore */ "@tauri-apps/api/window");
    const win = mod.getCurrentWindow();
    await win.close();
  } catch (err) {
    // If the Tauri API isn't available at runtime for some reason, fall back.
    if (import.meta.env.DEV) console.warn("[quit] Tauri window API failed", err);
    window.close();
  }
}
