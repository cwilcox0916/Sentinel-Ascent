/**
 * Protocols — equipable run modifiers.
 *
 * Spec: docs/my_game/04-progression-systems.md §6.
 *
 * Phase 10 ships 10 starter Protocols, level 1–7 (levels via copies), 3 base slots.
 * Every Protocol applies a multiplicative or additive modifier to the Sentinel's
 * baseline stats when equipped. The Protocol panel is **locked** while a Behemoth
 * or fleet enemy is alive (enforced in the UI + sim).
 *
 * Currency: Prisms. 10 Prisms/Protocol for a fresh copy (halved from the source pack
 * as part of the IAP-replacement promise). Copies also drop from Behemoth kills in a
 * later phase.
 */

import type { SentinelStats } from "../sim/types.ts";

export type ProtocolId =
  | "overclock"        // +damage
  | "rapid-fire"       // +attack speed
  | "long-barrel"      // +range
  | "reinforced-plating" // +max health
  | "adaptive-armor"    // +defense %
  | "spike-array"       // +thorns
  | "parasite-ion"      // +lifesteal
  | "price-gouger"      // +scrip bonus
  | "scavenger"         // +alloy/kill
  | "crit-matrix";      // +damage on boss cycles

export const MAX_PROTOCOL_LEVEL = 7;
export const BASE_PROTOCOL_SLOTS = 3;

export type ProtocolDefinition = {
  id: ProtocolId;
  name: string;
  description: string;
  /** Level 1..MAX_PROTOCOL_LEVEL. Level 0 means owned-but-not-yet-upgraded */
  apply: (out: SentinelStats, level: number) => void;
  /** For HUD: short line describing the effect at a given level. */
  formatEffect: (level: number) => string;
};

const PROTOCOLS: ProtocolDefinition[] = [
  {
    id: "overclock",
    name: "Overclock",
    description: "Sentinel fires with elevated voltage. +damage.",
    apply: (o, l) => { o.damage *= 1 + 0.08 * l; },
    formatEffect: (l) => `+${(8 * l).toFixed(0)}% damage`,
  },
  {
    id: "rapid-fire",
    name: "Rapid Fire",
    description: "Tuned turret cadence. +attack speed.",
    apply: (o, l) => { o.attackSpeed *= 1 + 0.06 * l; },
    formatEffect: (l) => `+${(6 * l).toFixed(0)}% attack speed`,
  },
  {
    id: "long-barrel",
    name: "Long Barrel",
    description: "Extended barrel assembly. +range.",
    apply: (o, l) => { o.range *= 1 + 0.05 * l; },
    formatEffect: (l) => `+${(5 * l).toFixed(0)}% range`,
  },
  {
    id: "reinforced-plating",
    name: "Reinforced Plating",
    description: "Sentinel core gains ablative mass. +max health.",
    apply: (o, l) => {
      const delta = 20 * l;
      o.maxHealth += delta;
      o.health += delta;
    },
    formatEffect: (l) => `+${20 * l} max health`,
  },
  {
    id: "adaptive-armor",
    name: "Adaptive Armor",
    description: "Damage-reactive plating.",
    apply: (o, l) => { o.defensePercent = Math.min(0.75, (o.defensePercent ?? 0) + 0.03 * l); },
    formatEffect: (l) => `+${(3 * l).toFixed(0)}% damage reduction`,
  },
  {
    id: "spike-array",
    name: "Spike Array",
    description: "Melee retaliation barbs.",
    apply: (o, l) => { o.thorns = (o.thorns ?? 0) + 5 * l; },
    formatEffect: (l) => `+${5 * l} thorns`,
  },
  {
    id: "parasite-ion",
    name: "Parasitic Ion",
    description: "Sentinel siphons mass from kills.",
    apply: (o, l) => { o.lifesteal = Math.min(0.5, (o.lifesteal ?? 0) + 0.015 * l); },
    formatEffect: (l) => `+${(1.5 * l).toFixed(1)}% lifesteal`,
  },
  {
    id: "price-gouger",
    name: "Price Gouger",
    description: "Scrip multiplier while active.",
    apply: (o, l) => { o.scripBonus = (o.scripBonus ?? 0) + 0.08 * l; },
    formatEffect: (l) => `+${(8 * l).toFixed(0)}% scrip`,
  },
  {
    id: "scavenger",
    name: "Scavenger",
    description: "Additional Alloy per kill.",
    apply: (o, l) => { o.alloyPerKill = (o.alloyPerKill ?? 0) + l; },
    formatEffect: (l) => `+${l} alloy/kill`,
  },
  {
    id: "crit-matrix",
    name: "Crit Matrix",
    description: "Latent burst-damage package.",
    apply: (o, l) => { o.damage += 4 * l; },
    formatEffect: (l) => `+${4 * l} flat damage`,
  },
];

export function listProtocols(): ReadonlyArray<ProtocolDefinition> {
  return PROTOCOLS;
}

export function getProtocol(id: ProtocolId): ProtocolDefinition {
  const p = PROTOCOLS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown Protocol: ${id}`);
  return p;
}

/** Persistent slot state (lives on SaveSlot). */
export type ProtocolSlotState = {
  /** Slots unlocked (1..N). Phase 10 starts at BASE_PROTOCOL_SLOTS; Archive
   * expands in Phase 14. */
  unlockedSlots: number;
  /** Which Protocols are equipped, in slot order. null = empty slot. */
  equipped: (ProtocolId | null)[];
  /** Level per owned Protocol. 0 means not owned. 1..MAX_PROTOCOL_LEVEL otherwise. */
  levels: Record<ProtocolId, number>;
  /** Copy count per Protocol. Level-up spends copies. */
  copies: Record<ProtocolId, number>;
};

export function createProtocolSlotState(): ProtocolSlotState {
  const levels = {} as Record<ProtocolId, number>;
  const copies = {} as Record<ProtocolId, number>;
  for (const p of PROTOCOLS) {
    levels[p.id] = 0;
    copies[p.id] = 0;
  }
  const equipped: (ProtocolId | null)[] = new Array(BASE_PROTOCOL_SLOTS).fill(null);
  return {
    unlockedSlots: BASE_PROTOCOL_SLOTS,
    equipped,
    levels,
    copies,
  };
}

/** Apply all equipped Protocols to the output stats (in place). */
export function applyProtocols(state: ProtocolSlotState, out: SentinelStats): void {
  for (const id of state.equipped) {
    if (!id) continue;
    const level = state.levels[id] ?? 0;
    if (level <= 0) continue;
    getProtocol(id).apply(out, level);
  }
}

/** Level-up cost curve: N copies required to go level → level+1. */
export function copiesToNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_PROTOCOL_LEVEL) return Infinity;
  // 1→2 = 2 copies, 2→3 = 4, 3→4 = 8, 4→5 = 16, 5→6 = 32, 6→7 = 64
  return 1 << currentLevel;
}

/** Purchase a fresh copy of a Protocol. Returns "bought" | "max-level" | "insufficient". */
export function buyProtocolCopy(
  state: ProtocolSlotState,
  currencies: { prisms: number },
  id: ProtocolId,
): "bought" | "max-level" | "insufficient" {
  const PRICE = 10;
  if (state.levels[id] >= MAX_PROTOCOL_LEVEL) return "max-level";
  if (currencies.prisms < PRICE) return "insufficient";
  currencies.prisms -= PRICE;
  if (state.levels[id] === 0) {
    state.levels[id] = 1;
  } else {
    state.copies[id] += 1;
  }
  return "bought";
}

/** Spend copies to level up. Returns new level or null if not enough copies. */
export function levelUpProtocol(state: ProtocolSlotState, id: ProtocolId): number | null {
  const cur = state.levels[id];
  if (cur <= 0 || cur >= MAX_PROTOCOL_LEVEL) return null;
  const needed = copiesToNextLevel(cur);
  if (state.copies[id] < needed) return null;
  state.copies[id] -= needed;
  state.levels[id] = cur + 1;
  return state.levels[id];
}

/** Equip into slot. Does nothing if Protocols are locked (Behemoth alive). */
export function equipProtocol(
  state: ProtocolSlotState,
  slotIx: number,
  id: ProtocolId | null,
): void {
  if (slotIx < 0 || slotIx >= state.unlockedSlots) return;
  if (id != null && state.levels[id] < 1) return; // not owned
  // Auto-unequip from any other slot so the same Protocol can't be double-equipped.
  if (id != null) {
    for (let i = 0; i < state.equipped.length; i++) {
      if (i !== slotIx && state.equipped[i] === id) state.equipped[i] = null;
    }
  }
  state.equipped[slotIx] = id;
}
