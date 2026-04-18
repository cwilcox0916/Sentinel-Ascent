/**
 * Enemy archetype catalogue.
 *
 * Phase 5 expands the Phase 1 Drone-only roster to all four normal archetypes
 * (Drone / Skimmer / Hulk / Lancer) plus the Behemoth boss.
 *
 * Spec: docs/my_game/02-enemies-and-wave-spec.md §3 + §4
 */

import type { EnemyArchetype } from "../types.ts";

export type RangedAttack = {
  /** How close to the Sentinel the enemy stops to fire. World units. */
  stoppingDistance: number;
  /** Seconds between shots. */
  cooldown: number;
  /** Damage dealt per projectile. */
  projectileDamage: number;
  /** Projectile world units / second. */
  projectileSpeed: number;
};

export type EnemyDefinition = {
  archetype: EnemyArchetype;
  baseHp: number;
  baseSpeed: number; // units / second toward the Sentinel
  baseContactDamage: number;
  baseAlloyReward: number;
  radius: number;
  /** If present, the enemy stops at `stoppingDistance` and fires projectiles. */
  ranged?: RangedAttack;
  /** Rough fraction of a Cycle's spawn budget when this archetype is in the mix. */
  spawnWeight?: number;
};

export const DRONE: EnemyDefinition = {
  archetype: "drone",
  baseHp: 12,
  baseSpeed: 55,
  baseContactDamage: 4,
  baseAlloyReward: 1,
  radius: 8,
  spawnWeight: 1.0,
};

export const SKIMMER: EnemyDefinition = {
  archetype: "skimmer",
  baseHp: 7, // low HP — easy to leak
  baseSpeed: 110, // ~2× Drone
  baseContactDamage: 3,
  baseAlloyReward: 1,
  radius: 7,
  spawnWeight: 0.6,
};

export const HULK: EnemyDefinition = {
  archetype: "hulk",
  baseHp: 60, // ~5× Drone
  baseSpeed: 28, // ~half Drone
  baseContactDamage: 12,
  baseAlloyReward: 4,
  radius: 14,
  spawnWeight: 0.35,
};

export const LANCER: EnemyDefinition = {
  archetype: "lancer",
  baseHp: 18,
  baseSpeed: 38,
  baseContactDamage: 5,
  baseAlloyReward: 3,
  radius: 9,
  ranged: {
    stoppingDistance: 220,
    cooldown: 1.6,
    projectileDamage: 6,
    projectileSpeed: 320,
  },
  spawnWeight: 0.45,
};

export const BEHEMOTH: EnemyDefinition = {
  archetype: "behemoth",
  baseHp: 600, // many multiples of Drone HP
  baseSpeed: 22,
  baseContactDamage: 35,
  baseAlloyReward: 50,
  radius: 28,
  // Behemoths are not in the normal spawn mix; they're scheduled.
};

/* ================ Phase 14: Fleet enemies ================ */
// Per docs/my_game/02-enemies-and-wave-spec.md §10–14. Fleet enemies are 20× Drone
// HP, move at distinct speeds per archetype, and carry immunities enforced by
// `isFleet` checks in arsenals.ts + enemies/ai.ts + projectiles.ts.

export const DISRUPTOR: EnemyDefinition = {
  archetype: "disruptor",
  baseHp: 240, // 20× Drone
  baseSpeed: 110, // 2× Drone
  baseContactDamage: 20,
  baseAlloyReward: 40,
  radius: 12,
  // Disruptor approaches the Sentinel and disables a random Arsenal on contact.
};

export const OVERSEER: EnemyDefinition = {
  archetype: "overseer",
  baseHp: 240,
  baseSpeed: 28, // 0.5× Drone
  baseContactDamage: 20,
  baseAlloyReward: 40,
  radius: 16,
  ranged: {
    // Overseer holds outside range and emits an aura; we model "holds outside" with
    // a long stoppingDistance so it never enters engagement.
    stoppingDistance: 340,
    cooldown: 999, // no projectiles — aura only
    projectileDamage: 0,
    projectileSpeed: 0,
  },
};

export const RESONANT: EnemyDefinition = {
  archetype: "resonant",
  baseHp: 240,
  baseSpeed: 55, // 1× Drone
  baseContactDamage: 15,
  baseAlloyReward: 40,
  radius: 13,
  ranged: {
    stoppingDistance: 300,
    cooldown: 2.2,
    projectileDamage: 18, // compound-doubling handled in projectiles.ts
    projectileSpeed: 180, // slow, visually distinct
  },
};

export const FLEET_ARCHETYPES: ReadonlySet<EnemyArchetype> = new Set([
  "disruptor",
  "overseer",
  "resonant",
]);

export function isFleet(archetype: EnemyArchetype): boolean {
  return FLEET_ARCHETYPES.has(archetype);
}

const ARCHETYPES: Partial<Record<EnemyArchetype, EnemyDefinition>> = {
  drone: DRONE,
  skimmer: SKIMMER,
  hulk: HULK,
  lancer: LANCER,
  behemoth: BEHEMOTH,
  disruptor: DISRUPTOR,
  overseer: OVERSEER,
  resonant: RESONANT,
};

/* ================ Fleet scheduling ================ */
// Full spec puts first fleet Cycle at 15 000 (Stratum 1). For demoability we
// introduce a dev-friendly schedule that triggers fleet onset by Stratum 14's
// equivalent position (Cycle 150), which is reachable inside an hour of play.
// Phase 17 calibration can tighten this back to spec values.

export const FLEET_ONSET_CYCLE = 150;
export const FLEET_REPEAT_INTERVAL = 50; // every 50 cycles after onset

export function isFleetCycle(cycle: number): boolean {
  if (cycle < FLEET_ONSET_CYCLE) return false;
  return (cycle - FLEET_ONSET_CYCLE) % FLEET_REPEAT_INTERVAL === 0;
}

/** Deterministic fleet-enemy selection for a given Cycle (rotates through roster). */
export function fleetForCycle(cycle: number): EnemyArchetype {
  const ix = Math.floor((cycle - FLEET_ONSET_CYCLE) / FLEET_REPEAT_INTERVAL) % 3;
  return ["disruptor", "overseer", "resonant"][ix] as EnemyArchetype;
}

export function getEnemyDefinition(archetype: EnemyArchetype): EnemyDefinition {
  const def = ARCHETYPES[archetype];
  if (!def) throw new Error(`Enemy archetype ${archetype} not yet implemented`);
  return def;
}

/**
 * Behemoth schedule. Behemoths spawn every 10 Cycles by default
 * (per docs/my_game/02-enemies-and-wave-spec.md §4 + 11-build-roadmap §5).
 */
export const BEHEMOTH_INTERVAL = 10;

export function isBehemothCycle(cycle: number): boolean {
  return cycle > 0 && cycle % BEHEMOTH_INTERVAL === 0;
}

export function cyclesToNextBehemoth(cycle: number): number {
  const next = (Math.floor(cycle / BEHEMOTH_INTERVAL) + 1) * BEHEMOTH_INTERVAL;
  return next - cycle;
}

/**
 * Returns the spawn-weight composition for a given Cycle.
 *
 * Phase 5 onboarding ramp:
 *   Cycles 1–2:   pure Drones (lets a fresh player learn the loop)
 *   Cycle 3+:     Skimmers join the mix
 *   Cycle 5+:     Hulks join
 *   Cycle 7+:     Lancers join
 *
 * Weights are normalized at spawn time.
 */
export function normalCompositionForCycle(cycle: number): EnemyDefinition[] {
  const composition: EnemyDefinition[] = [DRONE];
  if (cycle >= 3) composition.push(SKIMMER);
  if (cycle >= 5) composition.push(HULK);
  if (cycle >= 7) composition.push(LANCER);
  return composition;
}
