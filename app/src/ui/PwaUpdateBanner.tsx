/**
 * PWA update-available banner.
 *
 * Spec: docs/my_game/11-build-roadmap.md Phase 16 ("PWA Service Worker rolling update").
 *
 * Uses vite-plugin-pwa's `virtual:pwa-register` import. When a new service
 * worker is waiting, the banner offers a one-click reload. If the registration
 * module isn't available (e.g., during Vitest), this becomes a no-op.
 *
 * Dev mode and Tauri builds skip the banner (Tauri ships its own updater path).
 */

import { useEffect, useState } from "react";

type RegisterSWFn = (opts: {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}) => (reload?: boolean) => Promise<void>;

export function PwaUpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // Skip in dev / Tauri / test environments.
    if (import.meta.env.DEV) return;
    if (typeof window === "undefined") return;
    if ((window as unknown as { __TAURI__?: unknown }).__TAURI__) return;

    let cancelled = false;
    void import(/* @vite-ignore */ "virtual:pwa-register").then((mod: { registerSW: RegisterSWFn }) => {
      if (cancelled) return;
      const fn = mod.registerSW({
        onNeedRefresh: () => setNeedRefresh(true),
        onOfflineReady: () => {
          if (import.meta.env.DEV) console.info("[pwa] offline ready");
        },
      });
      setUpdateSW(() => fn);
    }).catch(() => {
      // Registration is optional — if the virtual module isn't present
      // (Vitest, ad-hoc dev builds), silently skip.
    });
    return () => { cancelled = true; };
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="alert">
      <div className="pwa-update-text">
        <span className="mono pwa-update-tag">UPDATE</span>
        <span>A new build is ready. Reload to apply?</span>
      </div>
      <div className="pwa-update-actions">
        <button
          className="pill"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
        <button
          className="pill primary"
          onClick={() => updateSW?.(true)}
        >
          Reload now
        </button>
      </div>
    </div>
  );
}
