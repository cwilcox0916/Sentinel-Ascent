/**
 * Shared simulation types.
 *
 * Coordinate system: world origin (0, 0) is the Sentinel core.
 * +x right, +y down (matches PixiJS / canvas convention).
 *
 * See docs/my_game/01-core-runtime-and-combat-spec.md §2.
 */

import type { PRNGState } from "./rng.ts";

export type Vec2 = { x: number; y: number };

export type EnemyArchetype =
  | "drone"
  | "skimmer"
  | "hulk"
  | "lancer"
  | "behemoth"
  | "aegis"
  | "leech"
  | "splitter"
  | "lance"
  | "disruptor"
  | "overseer"
  | "resonant";

export type EnemyState = "approaching" | "engaging" | "dying";

export type Enemy = {
  id: number;
  archetype: EnemyArchetype;
  pos: Vec2;
  prevPos: Vec2; // for render interpolation
  vel: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number; // units/sec inward
  contactDamage: number;
  alloyReward: number;
  state: EnemyState;
  spawnedAtCycle: number;
  /** Phase 5 ranged enemies (Lancer): seconds until next shot. */
  attackCooldown: number;
};

/** Projectiles fired by enemies (Lancer). Distinct from Sentinel projectiles. */
export type EnemyProjectile = {
  id: number;
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  damage: number;
  lifetime: number;
  radius: number;
};

export type Projectile = {
  id: number;
  ownerId: "sentinel"; // expand later (Arsenals, Sentries)
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  damage: number;
  lifetime: number; // seconds remaining
  radius: number;
};

/**
 * Sentinel stats. Phase 1 introduced the core combat fields; Phase 2 extends with
 * the in-run Forge stat surface (Defense %, Thorns, Lifesteal, Scrip Bonus, Alloy/Kill).
 * Full ~37 stats land across Phases 5+.
 */
export type SentinelStats = {
  damage: number;
  attackSpeed: number; // shots per second
  range: number;
  health: number;
  maxHealth: number;
  projectileSpeed: number;
  defensePercent: number; // 0..0.75
  thorns: number;
  lifesteal: number; // 0..0.5
  scripBonus: number; // multiplier, 0 = +0%
  alloyPerKill: number; // flat bonus per kill
};

export type Sentinel = {
  pos: Vec2; // always (0, 0) — but stored for consistency with Enemy/Projectile
  radius: number;
  attackCooldown: number; // seconds until next shot
  stats: SentinelStats;
};

export type RunState = {
  seed: bigint;
  rng: PRNGState;
  tickNumber: number;
  cycle: number;
  cycleProgressMs: number;
  cycleDurationMs: number; // wall-clock budget per Cycle (sim time, scaled by speed)
  cycleEnemyBudget: number; // remaining spawns this Cycle
  cycleSpawnAccumulator: number; // sub-tick spawn accumulator
  spawnerState: { behemothSpawnedThisCycle: boolean; fleetSpawnedThisCycle: boolean };
  scrip: number;
  alloy: number;
  baseSentinelStats: SentinelStats; // immutable per-run baseline; Forge layers on top
  sentinel: Sentinel;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: EnemyProjectile[];
  nextEntityId: number;
  ended: boolean; // true if Sentinel died
  /** Mutable Forge level state. Phase 2: in-run only; resets on run end. */
  forge: import("../meta/forge.ts").ForgeState;
  /** Auto-Procurement runtime state. Phase 4: Tier 1 only. */
  autoProcurement: import("./autoProcurement.ts").AutoProcurementState;
  /** Phase 7: Selected Stratum (difficulty band) + its multiplier. */
  stratum: number;
  stratumScale: number;
  /** Phase 8: lightweight telemetry counters consumed by the Run Log. */
  stats: {
    kills: number;
    damageDealt: number;
  };
  /** Phase 10: runtime Arsenal cooldowns + slow debuffs. Persisted per-run. */
  arsenals: import("./arsenals.ts").ArsenalRuntimeState;
  /** Phase 10: references (shared) to the slot's loadout state so sim + stat pipeline see owned levels. */
  arsenalSlot: import("../meta/arsenals.ts").ArsenalSlotState | null;
  protocolSlot: import("../meta/protocols.ts").ProtocolSlotState | null;
  augmentSlot: import("../meta/augments.ts").AugmentSlotState | null;
  /** Phase 11: per-run Boon state + shared Heirloom + Construct references. */
  boons: import("../meta/boons.ts").BoonRunState;
  heirloomSlot: import("../meta/heirlooms.ts").HeirloomSlotState | null;
  constructSlot: import("../meta/constructs.ts").ConstructSlotState | null;
  constructs: import("../meta/constructs.ts").ConstructRuntimeState;
  /** Phase 13: Warden + Subroutines. */
  wardenSlot: import("../meta/warden.ts").WardenSlotState | null;
  warden: import("../meta/warden.ts").WardenRuntimeState | null;
  /** Phase 14: fleet drops accumulated this run; host drains into slot.currencies. */
  fleetDrops: { fluxCrystals: number; augmentFragments: number };
  /** Phase 14: reference to the slot's Archive state so stat pipeline applies unlocks. */
  archive: import("../meta/archive.ts").ArchiveState | null;
  /** Phase 15: broadphase spatial hash rebuilt once per tick. Non-serialized. */
  enemyHash: import("./spatialHash.ts").EnemySpatialHash;
};
