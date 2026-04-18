/**
 * Augments — equipment-style gear pieces.
 *
 * Spec: docs/my_game/04-progression-systems.md §9.
 *
 * Phase 10 ships the **skeleton**: 4 slots, 4 starter Augments with flat stat
 * contributions, level-up via Augment Fragments. The full rarity system, affix
 * rolls, and Flux Crystal reroll land in a polish phase.
 */

import type { SentinelStats } from "../sim/types.ts";

export type AugmentId = "pulse-emitter" | "impact-lens" | "shield-capacitor" | "tracer-cog";

export const AUGMENT_SLOTS = 4;
export const AUGMENT_MAX_LEVEL = 10;

export type AugmentDefinition = {
  id: AugmentId;
  name: string;
  description: string;
  apply: (out: SentinelStats, level: number) => void;
  formatEffect: (level: number) => string;
};

const AUGMENTS: AugmentDefinition[] = [
  {
    id: "pulse-emitter",
    name: "Pulse Emitter",
    description: "Periodic pulse resonance boosts output damage.",
    apply: (o, l) => { o.damage *= 1 + 0.04 * l; },
    formatEffect: (l) => `+${(4 * l).toFixed(0)}% damage`,
  },
  {
    id: "impact-lens",
    name: "Impact Lens",
    description: "Focuses projectile velocity for accuracy at range.",
    apply: (o, l) => { o.range *= 1 + 0.03 * l; o.projectileSpeed *= 1 + 0.05 * l; },
    formatEffect: (l) => `+${(3 * l).toFixed(0)}% range · +${(5 * l).toFixed(0)}% projectile speed`,
  },
  {
    id: "shield-capacitor",
    name: "Shield Capacitor",
    description: "Stores kinetic energy as bonus health.",
    apply: (o, l) => {
      const delta = 15 * l;
      o.maxHealth += delta;
      o.health += delta;
    },
    formatEffect: (l) => `+${15 * l} max health`,
  },
  {
    id: "tracer-cog",
    name: "Tracer Cog",
    description: "Servo-assisted firing cadence.",
    apply: (o, l) => { o.attackSpeed *= 1 + 0.035 * l; },
    formatEffect: (l) => `+${(3.5 * l).toFixed(1)}% attack speed`,
  },
];

export function listAugments(): ReadonlyArray<AugmentDefinition> {
  return AUGMENTS;
}

export function getAugment(id: AugmentId): AugmentDefinition {
  const a = AUGMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown Augment: ${id}`);
  return a;
}

export type AugmentSlotState = {
  unlockedSlots: number;
  equipped: (AugmentId | null)[];
  levels: Record<AugmentId, number>;
};

export function createAugmentSlotState(): AugmentSlotState {
  const levels = {} as Record<AugmentId, number>;
  for (const a of AUGMENTS) levels[a.id] = 0;
  return {
    unlockedSlots: AUGMENT_SLOTS,
    equipped: new Array(AUGMENT_SLOTS).fill(null),
    levels,
  };
}

export function applyAugments(state: AugmentSlotState, out: SentinelStats): void {
  for (const id of state.equipped) {
    if (!id) continue;
    const level = state.levels[id] ?? 0;
    if (level <= 0) continue;
    getAugment(id).apply(out, level);
  }
}

export function augmentLevelUpCost(level: number): number {
  if (level <= 0) return 10; // base to acquire
  return Math.floor(10 * Math.pow(1.6, level));
}

export function buyAugment(
  state: AugmentSlotState,
  currencies: { augmentFragments: number },
  id: AugmentId,
): "bought" | "max-level" | "insufficient" {
  const cur = state.levels[id];
  if (cur >= AUGMENT_MAX_LEVEL) return "max-level";
  const cost = augmentLevelUpCost(cur);
  if (currencies.augmentFragments < cost) return "insufficient";
  currencies.augmentFragments -= cost;
  state.levels[id] = cur + 1;
  return "bought";
}

export function equipAugment(state: AugmentSlotState, slotIx: number, id: AugmentId | null): void {
  if (slotIx < 0 || slotIx >= state.unlockedSlots) return;
  if (id != null && state.levels[id] < 1) return;
  if (id != null) {
    for (let i = 0; i < state.equipped.length; i++) {
      if (i !== slotIx && state.equipped[i] === id) state.equipped[i] = null;
    }
  }
  state.equipped[slotIx] = id;
}
