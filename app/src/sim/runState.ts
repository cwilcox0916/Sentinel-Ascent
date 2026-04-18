import type { RunState, SentinelStats } from "./types.ts";
import { createRng } from "./rng.ts";
import { createForgeState } from "../meta/forge.ts";
import { createAutoProcurementState } from "./autoProcurement.ts";
import { createArsenalRuntimeState } from "./arsenals.ts";
import { createBoonRunState } from "../meta/boons.ts";
import { createConstructRuntimeState } from "../meta/constructs.ts";
import { EnemySpatialHash } from "./spatialHash.ts";

/**
 * Phase 1 baseline Sentinel stats. Tuned so a fresh run feels survivable
 * but not trivial — a Drone wave at Cycle 1 is killed in ~3 shots.
 *
 * In Phase 2 these are the *base* — the in-run Forge layers contributions
 * on top each time the player buys an upgrade.
 */
export const DEFAULT_SENTINEL_STATS: SentinelStats = {
  damage: 8,
  attackSpeed: 2.0,
  range: 280,
  health: 100,
  maxHealth: 100,
  projectileSpeed: 600,
  defensePercent: 0,
  thorns: 0,
  lifesteal: 0,
  scripBonus: 0,
  alloyPerKill: 0,
};

/** Phase 1: Cycle pacing. Each Cycle spawns roughly N enemies over its duration. */
export const CYCLE_DURATION_SECONDS = 12;

export type RunConfig = {
  stratum?: number;
  /** Multiplier applied to enemy HP/damage on top of Cycle scaling. */
  stratumScale?: number;
};

/** New-game RunState. Deterministic from the seed. */
export function createRunState(seed: bigint, config: RunConfig = {}): RunState {
  const baseStats: SentinelStats = { ...DEFAULT_SENTINEL_STATS };
  return {
    seed,
    rng: createRng(seed),
    tickNumber: 0,
    cycle: 1,
    cycleProgressMs: 0,
    cycleDurationMs: CYCLE_DURATION_SECONDS * 1000,
    cycleEnemyBudget: enemyBudgetForCycle(1),
    cycleSpawnAccumulator: 0,
    spawnerState: { behemothSpawnedThisCycle: false, fleetSpawnedThisCycle: false },
    scrip: 0,
    alloy: 0,
    baseSentinelStats: baseStats,
    sentinel: {
      pos: { x: 0, y: 0 },
      radius: 22,
      attackCooldown: 0,
      stats: { ...baseStats },
    },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    nextEntityId: 1,
    ended: false,
    forge: createForgeState(),
    autoProcurement: createAutoProcurementState(),
    stratum: config.stratum ?? 1,
    stratumScale: config.stratumScale ?? 1.0,
    stats: { kills: 0, damageDealt: 0 },
    arsenals: createArsenalRuntimeState(),
    arsenalSlot: null,
    protocolSlot: null,
    augmentSlot: null,
    boons: createBoonRunState(),
    heirloomSlot: null,
    constructSlot: null,
    constructs: createConstructRuntimeState(),
    wardenSlot: null,
    warden: null,
    fleetDrops: { fluxCrystals: 0, augmentFragments: 0 },
    archive: null,
    enemyHash: new EnemySpatialHash(),
  };
}

/**
 * Per-Cycle enemy spawn count. Phase 1 uses a simple curve; full per-Stratum
 * scaling lands in Phase 5 (see docs/my_game/02-enemies-and-wave-spec.md §17).
 */
export function enemyBudgetForCycle(cycle: number): number {
  return Math.floor(8 + cycle * 1.5);
}

export function nextEntityId(run: RunState): number {
  const id = run.nextEntityId;
  run.nextEntityId += 1;
  return id;
}
