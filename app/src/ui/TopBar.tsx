import { useRunStore } from "../store/runStore.ts";
import { useSaveStore } from "../store/saveStore.ts";
import { useAppStore } from "../store/appStore.ts";

/**
 * Top bar — locked structure per docs/my_game/10-design-system.md §4 (Top bar 52px).
 * Phase 3 wires the .save-ind flash to the autosave coordinator.
 */
export function TopBar() {
  const { cycle, scrip, alloy } = useRunStore((s) => s.summary);
  const saveFlash = useSaveStore((s) => s.saveFlash);
  const slotName = useAppStore((s) => s.activeSlot?.profile.displayName);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo logo-img">
          <img src="/icon-128.png" alt="Sentinel Ascent" />
        </div>
        <div>
          <div className="name">Sentinel Ascent</div>
          <div className="tag">{slotName ? `${slotName} · Stratum 01` : "Phase 3 · Save System"}</div>
        </div>
      </div>

      <div className="hud-chips">
        <div className="chip cycle">
          <div>
            <div className="lbl">Cycle</div>
            <div className="val mono">{cycle}</div>
          </div>
          <div className="delta mono">/ ∞</div>
        </div>
        <div className="chip scrip">
          <div>
            <div className="lbl">Scrip</div>
            <div className="val mono">{formatNum(scrip)}</div>
          </div>
        </div>
        <div className="chip alloy">
          <div>
            <div className="lbl">Alloy</div>
            <div className="val mono">{formatNum(alloy)}</div>
          </div>
        </div>
        <div className="chip prism">
          <div>
            <div className="lbl">Prisms</div>
            <div className="val mono">—</div>
          </div>
        </div>
        <div className="chip catalyst">
          <div>
            <div className="lbl">Catalyst</div>
            <div className="val mono">—</div>
          </div>
        </div>
        <div className="chip insignia">
          <div>
            <div className="lbl">Insignia</div>
            <div className="val mono">—</div>
          </div>
        </div>
      </div>

      <div className="spacer" />

      <span className="pill mono">00:00:00</span>

      <div className="speed-group">
        <button>1×</button>
        <button className="active">2×</button>
        <button>3×</button>
      </div>

      <span className="pill">⏸  Pause · Esc</span>

      <span className="pill" onClick={() => useAppStore.getState().setRoute("hangar")}>↩ Hangar</span>
      <span
        className="pill"
        onClick={() => useAppStore.getState().setRoute("main-menu")}
        title="Main Menu"
      >
        ⌂ Menu
      </span>

      <div className={`save-ind mono${saveFlash ? " flash" : ""}`} title="Autosave">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      </div>
    </header>
  );
}

function formatNum(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
