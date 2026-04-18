/**
 * Loadout overlay — three tabs (Protocols / Arsenals / Augments) for equipping,
 * buying, leveling up.
 *
 * Phase 10 scope: functional slot management + cost UI + Protocol lock enforcement.
 * Deeper visual design per docs/my_game/10-design-system.md lands in a polish phase.
 */

import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore.ts";
import { useRunStore } from "../../store/runStore.ts";
import {
  copiesToNextLevel,
  getProtocol,
  listProtocols,
  MAX_PROTOCOL_LEVEL,
} from "../../meta/protocols.ts";
import {
  arsenalLevelUpCost,
  ARSENAL_MAX_LEVEL,
  listArsenals,
  type ArsenalId,
} from "../../meta/arsenals.ts";
import {
  augmentLevelUpCost,
  AUGMENT_MAX_LEVEL,
  getAugment,
  listAugments,
  type AugmentId,
} from "../../meta/augments.ts";
import { listHeirlooms, HEIRLOOM_SLOTS, type HeirloomId } from "../../meta/heirlooms.ts";
import { listConstructs, type ConstructId } from "../../meta/constructs.ts";

type Tab = "protocols" | "arsenals" | "augments" | "heirlooms" | "constructs";

export function LoadoutHost() {
  const overlay = useAppStore((s) => s.overlay);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const open = overlay === "loadout";

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlay("none");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, setOverlay]);

  if (!open) return null;
  return <Loadout onClose={() => setOverlay("none")} />;
}

function Loadout({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("protocols");
  const slot = useAppStore((s) => s.activeSlot);
  const protocolsLocked = useRunStore((s) => s.summary.protocolsLocked);

  return (
    <div className="screen open" id="loadout-screen">
      <div className="screen-head">
        <div className="crumbs">
          <span className="parent">Run</span>
          <span className="sep">·</span>
          <span className="name">Loadout</span>
        </div>
        <div className="chips-mini" style={{ marginLeft: "auto" }}>
          <Chip label="Prisms" value={slot?.currencies.prisms ?? 0} color="var(--prism)" />
          <Chip label="Cores" value={slot?.currencies.cores ?? 0} color="var(--core)" />
          <Chip label="AugFrag" value={slot?.currencies.augmentFragments ?? 0} color="var(--cipher)" />
          <button className="pill" onClick={onClose}>✕ Close · Esc</button>
        </div>
      </div>

      <div className="loadout-tabs">
        <button
          className={`loadout-tab${tab === "protocols" ? " active" : ""}`}
          onClick={() => setTab("protocols")}
        >
          Protocols
          {protocolsLocked && <span className="lock-badge mono"> · LOCKED</span>}
        </button>
        <button
          className={`loadout-tab${tab === "arsenals" ? " active" : ""}`}
          onClick={() => setTab("arsenals")}
        >
          Arsenals
        </button>
        <button
          className={`loadout-tab${tab === "augments" ? " active" : ""}`}
          onClick={() => setTab("augments")}
        >
          Augments
        </button>
        <button
          className={`loadout-tab${tab === "heirlooms" ? " active" : ""}`}
          onClick={() => setTab("heirlooms")}
        >
          Heirlooms
        </button>
        <button
          className={`loadout-tab${tab === "constructs" ? " active" : ""}`}
          onClick={() => setTab("constructs")}
        >
          Constructs
        </button>
      </div>

      <div className="screen-body loadout-body">
        {tab === "protocols" && <ProtocolsTab locked={protocolsLocked} />}
        {tab === "arsenals" && <ArsenalsTab />}
        {tab === "augments" && <AugmentsTab />}
        {tab === "heirlooms" && <HeirloomsTab />}
        {tab === "constructs" && <ConstructsTab />}
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="chip-mini" style={{ ["--chip" as never]: color }}>
      <span className="lbl">{label}</span>
      <span className="val mono">{value}</span>
    </div>
  );
}

/* ================ Protocols tab ================ */

function ProtocolsTab({ locked }: { locked: boolean }) {
  const loadout = useRunStore((s) => s.loadout);
  const equipProtocol = useRunStore((s) => s.actions?.equipProtocol);
  const levelUp = useRunStore((s) => s.actions?.levelUpProtocol);
  const buyCopy = useRunStore((s) => s.actions?.buyProtocolCopy);

  if (!loadout) return <div className="mono">Loading loadout…</div>;
  const ps = loadout.protocols;

  return (
    <div className="lo-protocols">
      <div className="lo-slots">
        {Array.from({ length: ps.unlockedSlots }, (_, ix) => {
          const id = ps.equipped[ix];
          const def = id ? getProtocol(id) : null;
          const lvl = id ? ps.levels[id] ?? 0 : 0;
          return (
            <div key={ix} className={`lo-slot-card${id ? " filled" : " empty"}${locked ? " locked" : ""}`}>
              <div className="lo-slot-head mono">SLOT {ix + 1}</div>
              {def ? (
                <>
                  <div className="lo-slot-name">{def.name}</div>
                  <div className="lo-slot-effect mono">{def.formatEffect(lvl)}</div>
                  <button
                    className="lo-slot-unequip"
                    onClick={() => equipProtocol?.(ix, null)}
                    disabled={locked}
                  >
                    UNEQUIP
                  </button>
                </>
              ) : (
                <div className="lo-slot-empty mono">Empty — pick a Protocol below</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="lo-section-head mono">Library</div>
      <div className="lo-items">
        {listProtocols().map((def) => {
          const lvl = ps.levels[def.id] ?? 0;
          const copies = ps.copies[def.id] ?? 0;
          const equippedIx = ps.equipped.findIndex((e) => e === def.id);
          const owned = lvl > 0;
          const needed = copiesToNextLevel(lvl);
          const canLevel = owned && lvl < MAX_PROTOCOL_LEVEL && copies >= needed;
          return (
            <div key={def.id} className={`lo-item${owned ? " owned" : ""}${equippedIx >= 0 ? " equipped" : ""}`}>
              <div className="lo-item-head">
                <div className="lo-item-name">{def.name}</div>
                <div className="lo-item-lvl mono">
                  {owned ? `L${lvl}${copies > 0 ? ` · ${copies}c` : ""}` : "NOT OWNED"}
                </div>
              </div>
              <div className="lo-item-desc mono">{def.description}</div>
              <div className="lo-item-effect mono">{def.formatEffect(Math.max(1, lvl))}</div>
              <div className="lo-item-actions">
                {!owned ? (
                  <button className="lo-btn" onClick={() => buyCopy?.(def.id)}>
                    ACQUIRE · 10 PRISMS
                  </button>
                ) : (
                  <>
                    {lvl < MAX_PROTOCOL_LEVEL && (
                      <button
                        className="lo-btn"
                        onClick={() => buyCopy?.(def.id)}
                        title="Buy another copy (10 Prisms)"
                      >
                        +1 COPY · 10P
                      </button>
                    )}
                    {lvl < MAX_PROTOCOL_LEVEL && (
                      <button
                        className="lo-btn primary"
                        onClick={() => levelUp?.(def.id)}
                        disabled={!canLevel}
                        title={canLevel ? `Spend ${needed} copies to level up` : `Need ${needed} copies (${copies} owned)`}
                      >
                        LEVEL UP · {copies}/{needed}
                      </button>
                    )}
                    <button
                      className="lo-btn"
                      disabled={locked}
                      onClick={() => {
                        const emptyIx = ps.equipped.findIndex((e) => !e);
                        const targetIx = equippedIx >= 0 ? equippedIx : (emptyIx >= 0 ? emptyIx : 0);
                        equipProtocol?.(targetIx, equippedIx >= 0 ? null : def.id);
                      }}
                    >
                      {equippedIx >= 0 ? "UNEQUIP" : "EQUIP"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================ Arsenals tab ================ */

function ArsenalsTab() {
  const loadout = useRunStore((s) => s.loadout);
  const buyLvl = useRunStore((s) => s.actions?.buyArsenalLevel);
  const toggle = useRunStore((s) => s.actions?.toggleArsenalEquipped);
  if (!loadout) return <div className="mono">Loading…</div>;

  return (
    <div className="lo-items">
      {listArsenals().map((def) => {
        const lvl = loadout.arsenals.levels[def.id] ?? 0;
        const equipped = loadout.arsenals.equipped[def.id];
        const owned = lvl > 0;
        const cost = arsenalLevelUpCost(lvl);
        return (
          <div key={def.id} className={`lo-item${owned ? " owned" : ""}${equipped && owned ? " equipped" : ""}`}>
            <div className="lo-item-head">
              <div className="lo-item-name">{def.name}</div>
              <div className="lo-item-lvl mono">
                {owned ? `L${lvl} / ${ARSENAL_MAX_LEVEL}` : "LOCKED"}
              </div>
            </div>
            <div className="lo-item-desc mono">{def.role}</div>
            <div className="lo-item-effect mono">{def.formatEffect(Math.max(1, lvl))}</div>
            <div className="lo-item-actions">
              {lvl < ARSENAL_MAX_LEVEL && (
                <button className="lo-btn primary" onClick={() => buyLvl?.(def.id)}>
                  {owned ? `LEVEL UP · ${cost} CORES` : `ACQUIRE · ${cost} CORES`}
                </button>
              )}
              {owned && (
                <button className="lo-btn" onClick={() => toggle?.(def.id as ArsenalId, !equipped)}>
                  {equipped ? "DISARM" : "EQUIP"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================ Augments tab ================ */

function AugmentsTab() {
  const loadout = useRunStore((s) => s.loadout);
  const equipAugment = useRunStore((s) => s.actions?.equipAugment);
  const buyLvl = useRunStore((s) => s.actions?.buyAugmentLevel);
  if (!loadout) return <div className="mono">Loading…</div>;
  const as = loadout.augments;

  return (
    <div className="lo-augments">
      <div className="lo-slots">
        {Array.from({ length: as.unlockedSlots }, (_, ix) => {
          const id = as.equipped[ix];
          const def = id ? getAugment(id) : null;
          const lvl = id ? as.levels[id] ?? 0 : 0;
          return (
            <div key={ix} className={`lo-slot-card${id ? " filled" : " empty"}`}>
              <div className="lo-slot-head mono">SLOT {ix + 1}</div>
              {def ? (
                <>
                  <div className="lo-slot-name">{def.name}</div>
                  <div className="lo-slot-effect mono">{def.formatEffect(lvl)}</div>
                  <button className="lo-slot-unequip" onClick={() => equipAugment?.(ix, null)}>
                    UNEQUIP
                  </button>
                </>
              ) : (
                <div className="lo-slot-empty mono">Empty — pick an Augment below</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="lo-section-head mono">Library</div>
      <div className="lo-items">
        {listAugments().map((def) => {
          const lvl = as.levels[def.id] ?? 0;
          const owned = lvl > 0;
          const equippedIx = as.equipped.findIndex((e) => e === def.id);
          const cost = augmentLevelUpCost(lvl);
          return (
            <div key={def.id} className={`lo-item${owned ? " owned" : ""}${equippedIx >= 0 ? " equipped" : ""}`}>
              <div className="lo-item-head">
                <div className="lo-item-name">{def.name}</div>
                <div className="lo-item-lvl mono">
                  {owned ? `L${lvl} / ${AUGMENT_MAX_LEVEL}` : "NOT OWNED"}
                </div>
              </div>
              <div className="lo-item-desc mono">{def.description}</div>
              <div className="lo-item-effect mono">{def.formatEffect(Math.max(1, lvl))}</div>
              <div className="lo-item-actions">
                {lvl < AUGMENT_MAX_LEVEL && (
                  <button className="lo-btn primary" onClick={() => buyLvl?.(def.id as AugmentId)}>
                    {owned ? `LEVEL UP · ${cost} FRAG` : `ACQUIRE · ${cost} FRAG`}
                  </button>
                )}
                {owned && (
                  <button
                    className="lo-btn"
                    onClick={() => {
                      const emptyIx = as.equipped.findIndex((e) => !e);
                      const targetIx = equippedIx >= 0 ? equippedIx : (emptyIx >= 0 ? emptyIx : 0);
                      equipAugment?.(targetIx, equippedIx >= 0 ? null : (def.id as AugmentId));
                    }}
                  >
                    {equippedIx >= 0 ? "UNEQUIP" : "EQUIP"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================ Heirlooms tab ================ */

function HeirloomsTab() {
  const loadout = useRunStore((s) => s.loadout);
  const equip = useRunStore((s) => s.actions?.equipHeirloom);
  if (!loadout) return <div className="mono">Loading…</div>;
  const hs = loadout.heirlooms;

  return (
    <div className="lo-heirlooms">
      <div className="lo-slots">
        {Array.from({ length: HEIRLOOM_SLOTS }, (_, ix) => {
          const id = hs.equipped[ix];
          const def = id ? listHeirlooms().find((h) => h.id === id) : null;
          return (
            <div key={ix} className={`lo-slot-card${id ? " filled" : " empty"}`}>
              <div className="lo-slot-head mono">SLOT {ix + 1}</div>
              {def ? (
                <>
                  <div className="lo-slot-name">{def.name}</div>
                  <div className="lo-slot-effect mono">{def.description}</div>
                  <button className="lo-slot-unequip" onClick={() => equip?.(ix, null)}>
                    UNEQUIP
                  </button>
                </>
              ) : (
                <div className="lo-slot-empty mono">Empty — pick an Heirloom below</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="lo-section-head mono">Earned Heirlooms</div>
      <div className="lo-items">
        {listHeirlooms().map((def) => {
          const owned = hs.owned[def.id];
          const equippedIx = hs.equipped.findIndex((e) => e === def.id);
          return (
            <div
              key={def.id}
              className={`lo-item${owned ? " owned" : ""}${equippedIx >= 0 ? " equipped" : ""}`}
            >
              <div className="lo-item-head">
                <div className="lo-item-name">{def.name}</div>
                <div className="lo-item-lvl mono">{owned ? def.rarity.toUpperCase() : "NOT EARNED"}</div>
              </div>
              <div className="lo-item-desc mono">{def.description}</div>
              <div className="lo-item-actions">
                {owned && (
                  <button
                    className="lo-btn"
                    onClick={() => {
                      const emptyIx = hs.equipped.findIndex((e) => !e);
                      const targetIx = equippedIx >= 0 ? equippedIx : (emptyIx >= 0 ? emptyIx : 0);
                      equip?.(targetIx, equippedIx >= 0 ? null : (def.id as HeirloomId));
                    }}
                  >
                    {equippedIx >= 0 ? "UNEQUIP" : "EQUIP"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================ Constructs tab ================ */

function ConstructsTab() {
  const loadout = useRunStore((s) => s.loadout);
  const equip = useRunStore((s) => s.actions?.equipConstruct);
  if (!loadout) return <div className="mono">Loading…</div>;
  const cs = loadout.constructs;

  return (
    <div className="lo-constructs">
      <div className="lo-section-head mono">Assist Drone · 1 equipped</div>
      <div className="lo-items">
        {listConstructs().map((def) => {
          const owned = cs.owned[def.id];
          const equipped = cs.equipped === def.id;
          return (
            <div key={def.id} className={`lo-item${owned ? " owned" : ""}${equipped ? " equipped" : ""}`}>
              <div className="lo-item-head">
                <div className="lo-item-name">{def.name}</div>
                <div className="lo-item-lvl mono">{owned ? (equipped ? "EQUIPPED" : "OWNED") : "LOCKED"}</div>
              </div>
              <div className="lo-item-desc mono">{def.description}</div>
              <div className="lo-item-actions">
                {owned && (
                  <button
                    className="lo-btn"
                    onClick={() => equip?.(equipped ? null : (def.id as ConstructId))}
                  >
                    {equipped ? "UNEQUIP" : "EQUIP"}
                  </button>
                )}
                {!owned && (
                  <button className="lo-btn" disabled title="Earn from Order objectives (Phase 13)">
                    LOCKED
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
