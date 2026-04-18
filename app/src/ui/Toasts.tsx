import { useEffect } from "react";
import { useRunStore } from "../store/runStore.ts";

const REAP_INTERVAL_MS = 600;

/**
 * Toast stack (.toasts / .toast). Locked structure per docs/my_game/10-design-system.md §7.
 * Phase 4: shows a small green toast on every Auto-Procurement purchase.
 */
export function Toasts() {
  const toasts = useRunStore((s) => s.autoBuyToasts);
  const reap = useRunStore((s) => s.reapAutoBuyToasts);

  useEffect(() => {
    const t = window.setInterval(() => reap(), REAP_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [reap]);

  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.key} className="toast auto">
          ✓ {t.upgradeName} · −{t.cost} Scrip
        </div>
      ))}
    </div>
  );
}
