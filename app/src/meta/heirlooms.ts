/**
 * Heirlooms — permanent multiplicative bonuses earned from Order objectives,
 * Weekly Trial top placings, and event campaigns.
 *
 * Spec: docs/my_game/04-progression-systems.md §10.
 *
 * Phase 11 ships 6 starter Heirlooms + a slot strip (6 slots). Heirlooms layer
 * **before Forge** in the stat pipeline so their multipliers compound with Forge
 * percentages. The Research-Speed Heirloom specifically multiplies the Research
 * Bay's `effectiveSpeedMultiplier` as called out in the spec.
 */

import type { SentinelStats } from "../sim/types.ts";

export type HeirloomId =
  | "warmind-relic"
  | "ferrous-heart"
  | "catalyst-seed"
  | "chronometer"
  | "aether-lattice"
  | "argent-coil";

export const HEIRLOOM_SLOTS = 6;

export type HeirloomDefinition = {
  id: HeirloomId;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  /** Optional stat layer. Applied once per equipped Heirloom. */
  applyStat?: (out: SentinelStats) => void;
  /** Optional research-speed multiplier. Multiplied into Research Bay speed. */
  researchSpeedMultiplier?: number;
  /** Optional Scrip bonus stacking multiplier. */
  scripMultiplier?: number;
};

const HEIRLOOMS: HeirloomDefinition[] = [
  {
    id: "warmind-relic",
    name: "Warmind Relic",
    rarity: "rare",
    description: "+8% Sentinel damage (permanent).",
    applyStat: (o) => { o.damage *= 1.08; },
  },
  {
    id: "ferrous-heart",
    name: "Ferrous Heart",
    rarity: "rare",
    description: "+10% max health (permanent).",
    applyStat: (o) => { o.maxHealth *= 1.10; },
  },
  {
    id: "catalyst-seed",
    name: "Catalyst Seed",
    rarity: "epic",
    description: "+15% research speed (multiplicative with Project Acceleration).",
    researchSpeedMultiplier: 1.15,
  },
  {
    id: "chronometer",
    name: "Chronometer",
    rarity: "legendary",
    description: "+25% research speed.",
    researchSpeedMultiplier: 1.25,
  },
  {
    id: "aether-lattice",
    name: "Aether Lattice",
    rarity: "epic",
    description: "+12% range + 5% attack speed.",
    applyStat: (o) => { o.range *= 1.12; o.attackSpeed *= 1.05; },
  },
  {
    id: "argent-coil",
    name: "Argent Coil",
    rarity: "rare",
    description: "+15% Scrip earned.",
    scripMultiplier: 1.15,
  },
];

export function listHeirlooms(): ReadonlyArray<HeirloomDefinition> {
  return HEIRLOOMS;
}

export function getHeirloom(id: HeirloomId): HeirloomDefinition {
  const h = HEIRLOOMS.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown Heirloom: ${id}`);
  return h;
}

/** Persistent slot state (on SaveSlot). */
export type HeirloomSlotState = {
  /** Owned Heirlooms (Phase 11 seeds the slot state; Phase 13 earns them via Order). */
  owned: Record<HeirloomId, boolean>;
  /** Equipped slot order (null = empty). */
  equipped: (HeirloomId | null)[];
};

export function createHeirloomSlotState(): HeirloomSlotState {
  const owned = {} as Record<HeirloomId, boolean>;
  for (const h of HEIRLOOMS) owned[h.id] = false;
  return {
    owned,
    equipped: new Array(HEIRLOOM_SLOTS).fill(null),
  };
}

export function applyHeirloomStats(state: HeirloomSlotState, out: SentinelStats): void {
  for (const id of state.equipped) {
    if (!id) continue;
    if (!state.owned[id]) continue;
    getHeirloom(id).applyStat?.(out);
  }
}

/** Aggregate research-speed multiplier from equipped Heirlooms. */
export function heirloomResearchMultiplier(state: HeirloomSlotState | null): number {
  if (!state) return 1;
  let mult = 1;
  for (const id of state.equipped) {
    if (!id || !state.owned[id]) continue;
    const def = getHeirloom(id);
    if (def.researchSpeedMultiplier) mult *= def.researchSpeedMultiplier;
  }
  return mult;
}

/** Aggregate Scrip multiplier from equipped Heirlooms. Applied on kill reward. */
export function heirloomScripMultiplier(state: HeirloomSlotState | null): number {
  if (!state) return 1;
  let mult = 1;
  for (const id of state.equipped) {
    if (!id || !state.owned[id]) continue;
    const def = getHeirloom(id);
    if (def.scripMultiplier) mult *= def.scripMultiplier;
  }
  return mult;
}

export function equipHeirloom(state: HeirloomSlotState, slotIx: number, id: HeirloomId | null): void {
  if (slotIx < 0 || slotIx >= HEIRLOOM_SLOTS) return;
  if (id != null && !state.owned[id]) return;
  if (id != null) {
    for (let i = 0; i < state.equipped.length; i++) {
      if (i !== slotIx && state.equipped[i] === id) state.equipped[i] = null;
    }
  }
  state.equipped[slotIx] = id;
}

export function grantHeirloom(state: HeirloomSlotState, id: HeirloomId): void {
  state.owned[id] = true;
}
