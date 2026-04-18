/**
 * Bottom dock — locked structure per docs/my_game/10-design-system.md §4.
 * Hidden below 1280px (handled in shell.css).
 *
 * Phase 10: displays real Protocol slots, Arsenal slots (with cooldown overlays),
 * and a short Cycle-track strip. Clicking any slot opens the Loadout overlay.
 */

import { useAppStore } from "../store/appStore.ts";
import { useRunStore } from "../store/runStore.ts";
import { getProtocol, type ProtocolId } from "../meta/protocols.ts";
import { getArsenal, listArsenals, effectiveCooldownSec, type ArsenalId } from "../meta/arsenals.ts";

export function BottomDock() {
  const loadout = useRunStore((s) => s.loadout);
  const summary = useRunStore((s) => s.summary);
  const openLoadout = useAppStore((s) => s.setOverlay);

  return (
    <section className="bottom-dock">
      <div className="dock-block">
        <div className="dock-head">
          Protocols {summary.protocolsLocked && <span className="dock-lock mono">· LOCKED</span>}
        </div>
        <div className="dock-row">
          {loadout
            ? loadout.protocols.equipped.slice(0, loadout.protocols.unlockedSlots).map((id, ix) => (
                <ProtocolSlot
                  key={ix}
                  protocolId={id}
                  onOpen={() => openLoadout("loadout")}
                />
              ))
            : Array.from({ length: 3 }).map((_, ix) => (
                <div key={ix} className="protocol-slot empty" />
              ))}
        </div>
      </div>

      <div className="dock-divider" />

      <div className="dock-block" style={{ flex: 1 }}>
        <div className="dock-head">Arsenals · Auto-fire on cooldown</div>
        <div className="dock-row">
          {listArsenals().map((def) => (
            <ArsenalSlot
              key={def.id}
              arsenalId={def.id}
              onOpen={() => openLoadout("loadout")}
            />
          ))}
        </div>
      </div>

      <div className="dock-divider" />

      <div className="dock-block" style={{ minWidth: 180 }}>
        <div className="dock-head">Cycle track · next 10</div>
        <div className="dock-row">
          <CycleStrip cycle={summary.cycle} />
        </div>
      </div>
    </section>
  );
}

function ProtocolSlot({
  protocolId,
  onOpen,
}: {
  protocolId: ProtocolId | null;
  onOpen: () => void;
}) {
  const loadout = useRunStore((s) => s.loadout);
  const level = protocolId && loadout ? loadout.protocols.levels[protocolId] ?? 0 : 0;
  if (!protocolId) {
    return (
      <button className="protocol-slot empty" onClick={onOpen} title="Equip a Protocol">
        <span className="slot-plus">+</span>
      </button>
    );
  }
  const def = getProtocol(protocolId);
  return (
    <button className="protocol-slot filled" onClick={onOpen} title={`${def.name} · L${level}`}>
      <span className="slot-label">{initials(def.name)}</span>
      <span className="slot-lvl mono">L{level}</span>
    </button>
  );
}

function ArsenalSlot({
  arsenalId,
  onOpen,
}: {
  arsenalId: ArsenalId;
  onOpen: () => void;
}) {
  const loadout = useRunStore((s) => s.loadout);
  const cooldowns = useRunStore((s) => s.summary.arsenalCooldowns);
  const def = getArsenal(arsenalId);
  if (!loadout) return <div className="arsenal-slot empty" />;
  const level = loadout.arsenals.levels[arsenalId] ?? 0;
  const owned = level > 0;
  const equipped = loadout.arsenals.equipped[arsenalId] && owned;
  const maxCd = effectiveCooldownSec(def, level);
  const remaining = cooldowns[arsenalId] ?? 0;
  const cdPct = maxCd > 0 ? Math.max(0, Math.min(1, remaining / maxCd)) : 0;
  return (
    <button
      className={`arsenal-slot${owned ? " owned" : ""}${equipped ? " equipped" : ""}`}
      onClick={onOpen}
      title={`${def.name} · ${owned ? `L${level}` : "LOCKED"}`}
    >
      <span className="slot-label">{initials(def.name)}</span>
      <span className="slot-lvl mono">{owned ? `L${level}` : "—"}</span>
      {equipped && maxCd > 0 && (
        <span
          className="arsenal-cd"
          style={{ transform: `scaleY(${cdPct})` }}
        />
      )}
    </button>
  );
}

function CycleStrip({ cycle }: { cycle: number }) {
  // 10 ticks, current cycle pulses; every 10th is a Behemoth marker.
  return (
    <div className="cycle-strip">
      {Array.from({ length: 10 }, (_, i) => {
        const n = cycle + i;
        const isBoss = n > 0 && n % 10 === 0;
        return (
          <div
            key={i}
            className={`cs-tick${i === 0 ? " current" : ""}${isBoss ? " boss" : ""}`}
            title={`Cycle ${n}${isBoss ? " · Behemoth" : ""}`}
          />
        );
      })}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
