/**
 * Boons — mid-run choice shaping the current session.
 *
 * Spec: docs/my_game/04-progression-systems.md §7.
 *
 * Phase 11 ships 12 starter Boons. Three are offered every 25 Cycles (sim
 * deterministic: the pool is picked with `run.rng`, so the same seed always
 * produces the same three at each offer Cycle). The player picks one; its
 * effect is applied immediately to RunState and persists for the rest of the run.
 *
 * Each Boon is one of three flavors:
 *   - STAT — applies a +% multiplier to a Sentinel stat via an in-run-only layer
 *   - ECON — grants Scrip/Alloy now, or boosts scripBonus/alloyPerKill
 *   - UTILITY — full-heal, drop-enemies-to-1HP, etc.
 */

import type { RunState, SentinelStats } from "../sim/types.ts";
import { nextFloat } from "../sim/rng.ts";

export const BOON_CYCLE_INTERVAL = 25;
export const BOONS_OFFERED = 3;

export type BoonId =
  | "overclocked-core"   // +20% damage
  | "kinetic-drive"      // +15% attack speed
  | "extended-reticle"   // +15% range
  | "armor-plating"      // +50 max health + heal
  | "ironclad"           // +10% defense %
  | "vampiric-coil"      // +5% lifesteal
  | "scrip-conduit"      // +25% scrip bonus
  | "alloy-vein"         // +2 alloy/kill
  | "emergency-repair"   // full heal immediately
  | "purge"              // all current enemies → 1 HP
  | "runner-high"        // +10% damage + attack speed
  | "quartermaster";     // +500 scrip now

export type BoonDefinition = {
  id: BoonId;
  name: string;
  description: string;
  flavor: "stat" | "econ" | "utility";
  apply: (run: RunState) => void;
};

const BOONS: BoonDefinition[] = [
  {
    id: "overclocked-core",
    name: "Overclocked Core",
    description: "+20% damage for the rest of this run.",
    flavor: "stat",
    apply: (run) => { run.boons.multipliers.damage *= 1.20; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "kinetic-drive",
    name: "Kinetic Drive",
    description: "+15% attack speed for the rest of this run.",
    flavor: "stat",
    apply: (run) => { run.boons.multipliers.attackSpeed *= 1.15; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "extended-reticle",
    name: "Extended Reticle",
    description: "+15% range for the rest of this run.",
    flavor: "stat",
    apply: (run) => { run.boons.multipliers.range *= 1.15; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "armor-plating",
    name: "Armor Plating",
    description: "+50 max health, healed to full.",
    flavor: "stat",
    apply: (run) => {
      run.boons.flatDelta.maxHealth += 50;
      /* host recomputes stats after chooseBoon returns */
      run.sentinel.stats.health = run.sentinel.stats.maxHealth;
    },
  },
  {
    id: "ironclad",
    name: "Ironclad",
    description: "+10% damage reduction.",
    flavor: "stat",
    apply: (run) => { run.boons.flatDelta.defensePercent += 0.10; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "vampiric-coil",
    name: "Vampiric Coil",
    description: "+5% lifesteal.",
    flavor: "stat",
    apply: (run) => { run.boons.flatDelta.lifesteal += 0.05; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "scrip-conduit",
    name: "Scrip Conduit",
    description: "+25% Scrip earned for the rest of this run.",
    flavor: "econ",
    apply: (run) => { run.boons.flatDelta.scripBonus += 0.25; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "alloy-vein",
    name: "Alloy Vein",
    description: "+2 Alloy per kill.",
    flavor: "econ",
    apply: (run) => { run.boons.flatDelta.alloyPerKill += 2; /* host recomputes stats after chooseBoon returns */ },
  },
  {
    id: "emergency-repair",
    name: "Emergency Repair",
    description: "Restore Sentinel to full health immediately.",
    flavor: "utility",
    apply: (run) => { run.sentinel.stats.health = run.sentinel.stats.maxHealth; },
  },
  {
    id: "purge",
    name: "Purge Protocol",
    description: "Drop every enemy currently on the Grid to 1 HP.",
    flavor: "utility",
    apply: (run) => {
      for (const e of run.enemies) if (e.state !== "dying") e.hp = 1;
    },
  },
  {
    id: "runner-high",
    name: "Runner's High",
    description: "+10% damage and +10% attack speed.",
    flavor: "stat",
    apply: (run) => {
      run.boons.multipliers.damage *= 1.10;
      run.boons.multipliers.attackSpeed *= 1.10;
      /* host recomputes stats after chooseBoon returns */
    },
  },
  {
    id: "quartermaster",
    name: "Quartermaster",
    description: "+500 Scrip right now.",
    flavor: "econ",
    apply: (run) => { run.scrip += 500; },
  },
];

export function listBoons(): ReadonlyArray<BoonDefinition> {
  return BOONS;
}

export function getBoon(id: BoonId): BoonDefinition {
  const b = BOONS.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown Boon: ${id}`);
  return b;
}

/** Per-run Boon accumulator. Layers on top of Protocols/Augments/Forge. */
export type BoonRunState = {
  /** Ids of Boons chosen this run, in order. */
  chosen: BoonId[];
  /** Multiplicative stat deltas from stat-flavor Boons. */
  multipliers: {
    damage: number;
    attackSpeed: number;
    range: number;
  };
  /** Flat additive deltas (applied after protocols/augments/forge). */
  flatDelta: {
    maxHealth: number;
    defensePercent: number;
    lifesteal: number;
    scripBonus: number;
    alloyPerKill: number;
  };
  /** Pending offer — when non-null, sim pauses boon decisions and UI shows a choice. */
  pending: { atCycle: number; options: BoonId[] } | null;
  /** Last cycle at which a Boon offer was issued (prevents re-offer). */
  lastOfferedAtCycle: number;
};

export function createBoonRunState(): BoonRunState {
  return {
    chosen: [],
    multipliers: { damage: 1, attackSpeed: 1, range: 1 },
    flatDelta: { maxHealth: 0, defensePercent: 0, lifesteal: 0, scripBonus: 0, alloyPerKill: 0 },
    pending: null,
    lastOfferedAtCycle: 0,
  };
}

/** Applied in the stat layer pipeline AFTER Protocols/Augments/Forge. */
export function applyBoons(boons: BoonRunState, out: SentinelStats): void {
  out.damage *= boons.multipliers.damage;
  out.attackSpeed *= boons.multipliers.attackSpeed;
  out.range *= boons.multipliers.range;
  out.maxHealth += boons.flatDelta.maxHealth;
  out.defensePercent = Math.min(0.75, out.defensePercent + boons.flatDelta.defensePercent);
  out.lifesteal = Math.min(0.5, out.lifesteal + boons.flatDelta.lifesteal);
  out.scripBonus = out.scripBonus + boons.flatDelta.scripBonus;
  out.alloyPerKill = out.alloyPerKill + boons.flatDelta.alloyPerKill;
}

/** Called from tick.ts — if we just rolled into a new interval Cycle, offer Boons. */
export function maybeOfferBoons(run: RunState): void {
  const boons = run.boons;
  if (!boons || boons.pending) return;
  if (run.cycle <= 0) return;
  if (run.cycle % BOON_CYCLE_INTERVAL !== 0) return;
  if (run.cycle === boons.lastOfferedAtCycle) return;
  // Don't offer on the Cycle we just landed on if we already chose this run at this Cycle.
  boons.lastOfferedAtCycle = run.cycle;
  boons.pending = { atCycle: run.cycle, options: pickOptions(run, BOONS_OFFERED) };
}

function pickOptions(run: RunState, count: number): BoonId[] {
  // Deterministic weighted draw using run.rng. Avoid repeating a chosen Boon.
  const pool = BOONS.filter((b) => !run.boons.chosen.includes(b.id)).map((b) => b.id);
  const out: BoonId[] = [];
  const working = pool.slice();
  for (let i = 0; i < count && working.length > 0; i++) {
    const ix = Math.floor(nextFloat(run.rng) * working.length) % working.length;
    out.push(working[ix]!);
    working.splice(ix, 1);
  }
  return out;
}

/** Player picks a Boon from the pending offer. */
export function chooseBoon(run: RunState, id: BoonId): "chosen" | "no-offer" | "unknown" {
  const boons = run.boons;
  if (!boons || !boons.pending) return "no-offer";
  if (!boons.pending.options.includes(id)) return "unknown";
  boons.chosen.push(id);
  boons.pending = null;
  getBoon(id).apply(run);
  return "chosen";
}

