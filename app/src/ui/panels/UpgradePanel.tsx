import { useState } from "react";
import { useRunStore, type ForgeRowView } from "../../store/runStore.ts";
import type { UpgradeCategory } from "../../meta/forge.ts";
import { AutoProcurementPanel } from "./AutoProcurementPanel.tsx";

const AUTO_BOUGHT_FLASH_TICKS = 36; // ~600 ms at 60 Hz

/**
 * Forge in-run upgrade panel. Locked structure per docs/my_game/10-design-system.md §4 + §7
 * (Right panel · 400px · Forge tabs Attack/Defense/Utility · scrollable .upgrade-list of .up-row).
 *
 * Phase 4 wires the .auto-glow tab dot when Auto-Procurement is active in that
 * category, and applies .auto-bought to rows for ~600 ms after each automated buy.
 */
export function UpgradePanel() {
  const [tab, setTab] = useState<UpgradeCategory>("attack");
  const rows = useRunStore((s) => s.forgeRows[tab]);
  const buyUpgrade = useRunStore((s) => s.actions?.buyUpgrade);
  const ap = useRunStore((s) => s.autoProcurement);
  const recentAutoBuys = useRunStore((s) => s.recentAutoBuys);
  const tickNumber = useRunStore((s) => s.summary.cycle * 0); // any change re-renders; real tick on summary
  const currentTickApprox = useRunStore((s) => s.summary.cycle); // cheap re-render trigger
  void currentTickApprox;
  void tickNumber;

  // Use Date.now-based recency so the keyframe still plays even if no summary update
  // arrived for the row that auto-bought.
  const now = Date.now();

  return (
    <aside className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <h3>Forge · In-Run</h3>
          <span className="sub">Spend Scrip · upgrades reset on run end</span>
        </div>
        <div className="tabs">
          {(["attack", "defense", "utility"] as const).map((t) => {
            const autoOn = ap.tier1Enabled && ap.tier1Category === t;
            return (
              <button
                key={t}
                className={`tab${tab === t ? " active" : ""}${autoOn ? " auto-on" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
                <span className="auto-glow" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="upgrade-list">
        {rows.map((row) => {
          const lastAutoMs = recentAutoBuys[row.id] ?? 0;
          const flashing = now - lastAutoMs < (AUTO_BOUGHT_FLASH_TICKS / 60) * 1000;
          const autoTarget =
            ap.tier1Enabled && ap.tier1Category === tab; // Tier 1 paints all rows in the active category
          return (
            <UpgradeRow
              key={row.id}
              row={row}
              flashing={flashing}
              autoTarget={autoTarget}
              onBuy={() => buyUpgrade?.(row.id)}
            />
          );
        })}
      </div>

      <AutoProcurementPanel />
    </aside>
  );
}

function UpgradeRow({
  row,
  flashing,
  autoTarget,
  onBuy,
}: {
  row: ForgeRowView;
  flashing: boolean;
  autoTarget: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      className={`up-row${row.affordable ? "" : " unaffordable"}${flashing ? " auto-bought" : ""}${autoTarget ? " auto-target" : ""}`}
      onClick={() => row.affordable && onBuy()}
    >
      <div className="name">
        {row.name}
        <span className="lvl mono">L{row.level}</span>
      </div>
      <div className="stat-line">{row.statLine}</div>
      <div className="cost">
        <span className="amt mono">{formatCost(row.cost)}</span>
        <span className="pay">Scrip</span>
      </div>
      <span className="auto-pin" />
    </div>
  );
}

function formatCost(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
