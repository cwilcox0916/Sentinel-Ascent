/**
 * Arsenals — premium parallel-kill systems.
 *
 * Spec: docs/my_game/04-progression-systems.md §8, docs/my_game/01-core-runtime-and-combat-spec.md §11.
 *
 * Phase 10 ships the 3 starter Arsenals:
 *   - Arc Cascade — passive chain-damage proc on Sentinel hit
 *   - Seeker Salvo — periodic homing-missile volley at random enemies
 *   - Stasis Field — periodic AoE slow around the Sentinel
 *
 * All owned Arsenals can be slotted together in a run; they auto-fire when their
 * cooldown reaches zero. Upgrades cost Cores (a permanent currency that doesn't
 * accumulate in gameplay yet — Phase 12 handles that).
 */

export type ArsenalId = "arc-cascade" | "seeker-salvo" | "stasis-field";

export type ArsenalDefinition = {
  id: ArsenalId;
  name: string;
  role: string;
  /** Seconds between auto-fires at level 1. Each level reduces cooldown by 10%. */
  baseCooldownSec: number;
  /** Level 1..10. */
  maxLevel: number;
  formatEffect: (level: number) => string;
};

export const ARSENAL_MAX_LEVEL = 10;

const ARSENALS: ArsenalDefinition[] = [
  {
    id: "arc-cascade",
    name: "Arc Cascade",
    role: "On-hit chain damage proc",
    baseCooldownSec: 0, // passive; cooldown unused
    maxLevel: ARSENAL_MAX_LEVEL,
    formatEffect: (l) => `${(5 + 3 * l).toFixed(0)}% proc chance, ${5 + 3 * l} bonus damage`,
  },
  {
    id: "seeker-salvo",
    name: "Seeker Salvo",
    role: "Tracking missile barrage",
    baseCooldownSec: 8,
    maxLevel: ARSENAL_MAX_LEVEL,
    formatEffect: (l) => `${2 + Math.floor(l / 2)} missiles, ${10 + 6 * l} dmg each`,
  },
  {
    id: "stasis-field",
    name: "Stasis Field",
    role: "Slowing AoE pulse",
    baseCooldownSec: 12,
    maxLevel: ARSENAL_MAX_LEVEL,
    formatEffect: (l) => `${40 + 5 * l}% slow for ${(2 + 0.2 * l).toFixed(1)}s`,
  },
];

export function listArsenals(): ReadonlyArray<ArsenalDefinition> {
  return ARSENALS;
}

export function getArsenal(id: ArsenalId): ArsenalDefinition {
  const a = ARSENALS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown Arsenal: ${id}`);
  return a;
}

/** Persistent per-slot state (on SaveSlot). */
export type ArsenalSlotState = {
  /** Level per owned Arsenal. 0 = not owned. */
  levels: Record<ArsenalId, number>;
  /** Whether equipped (toggled on for this loadout). */
  equipped: Record<ArsenalId, boolean>;
};

export function createArsenalSlotState(): ArsenalSlotState {
  const levels = {} as Record<ArsenalId, number>;
  const equipped = {} as Record<ArsenalId, boolean>;
  for (const a of ARSENALS) {
    levels[a.id] = 0;
    equipped[a.id] = false;
  }
  return { levels, equipped };
}

/** Cost to reach `level` from `level-1`. Cores currency. */
export function arsenalLevelUpCost(level: number): number {
  if (level <= 0) return 5; // buy-to-own cost
  return Math.floor(5 * Math.pow(1.8, level));
}

export function buyArsenal(
  state: ArsenalSlotState,
  currencies: { cores: number },
  id: ArsenalId,
): "bought" | "max-level" | "insufficient" {
  const cur = state.levels[id];
  if (cur >= ARSENAL_MAX_LEVEL) return "max-level";
  const cost = arsenalLevelUpCost(cur);
  if (currencies.cores < cost) return "insufficient";
  currencies.cores -= cost;
  state.levels[id] = cur + 1;
  if (cur === 0) state.equipped[id] = true; // auto-equip on first acquire
  return "bought";
}

export function toggleArsenalEquipped(
  state: ArsenalSlotState,
  id: ArsenalId,
  equipped: boolean,
): void {
  if (state.levels[id] <= 0) return;
  state.equipped[id] = equipped;
}

export function effectiveCooldownSec(def: ArsenalDefinition, level: number): number {
  return def.baseCooldownSec * Math.pow(0.9, Math.max(0, level - 1));
}
