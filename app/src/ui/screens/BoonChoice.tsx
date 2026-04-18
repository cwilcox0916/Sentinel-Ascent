/**
 * Boon Choice overlay — full-viewport modal that pops up every 25 Cycles.
 *
 * Spec: docs/my_game/04-progression-systems.md §7 — "three offered, one chosen".
 *
 * Mounts when `useRunStore(s => s.summary.boonOffer)` is non-null.
 * Ignoring the overlay leaves the offer pending (player can look at the field
 * before picking). Picking dispatches `chooseBoon(id)` via the action bus.
 */

import { useRunStore } from "../../store/runStore.ts";
import { getBoon } from "../../meta/boons.ts";

export function BoonChoiceHost() {
  const offer = useRunStore((s) => s.summary.boonOffer);
  const choose = useRunStore((s) => s.actions?.chooseBoon);
  if (!offer) return null;

  return (
    <div className="boon-overlay" role="dialog" aria-label="Choose a Boon">
      <div className="boon-card-host">
        <div className="boon-header">
          <div className="boon-stamp mono">▲ CYCLE {String(offer.atCycle).padStart(2, "0")} · BOON</div>
          <div className="boon-title">Choose one</div>
          <div className="boon-sub mono">The Grid pauses until you decide.</div>
        </div>
        <div className="boon-grid">
          {offer.options.map((id) => {
            const def = getBoon(id);
            return (
              <button
                key={id}
                className={`boon-card ${def.flavor}`}
                onClick={() => choose?.(id)}
              >
                <div className="boon-flavor mono">{def.flavor.toUpperCase()}</div>
                <div className="boon-name">{def.name}</div>
                <div className="boon-desc">{def.description}</div>
                <div className="boon-cta mono">ACCEPT</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
