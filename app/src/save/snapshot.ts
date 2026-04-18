/**
 * Mid-run snapshot — serialize a live RunState into a JSON-safe blob and restore
 * it back into a fresh RunState that resumes deterministically.
 *
 * Determinism contract: snapshot at tick N → restore → simulate → output equals
 * "did not snapshot, just simulated" output. The PRNG state is the linchpin.
 *
 * Spec: docs/my_game/07-save-system-spec.md §6
 */

import type { RunState, EnemyArchetype, EnemyState } from "../sim/types.ts";
import type { RunSnapshot, SerializedSentinelStats } from "./schema.ts";
import { CYCLE_DURATION_SECONDS, DEFAULT_SENTINEL_STATS } from "../sim/runState.ts";
import { createForgeState, type UpgradeId, type UpgradeCategory } from "../meta/forge.ts";
import { createRng, deserialize as rngDeserialize, serialize as rngSerialize } from "../sim/rng.ts";
import {
  createAutoProcurementState,
  createTier3Defaults,
  type AutoProcurementTier,
  type Rule,
  type Tier3Config,
  type Tier4Config,
} from "../sim/autoProcurement.ts";
import { createArsenalRuntimeState } from "../sim/arsenals.ts";
import { EnemySpatialHash } from "../sim/spatialHash.ts";
import { createBoonRunState, type BoonId, type BoonRunState } from "../meta/boons.ts";
import { createConstructRuntimeState } from "../meta/constructs.ts";

export function snapshotRun(run: RunState): RunSnapshot {
  return {
    seed: run.seed.toString(),
    rngState: rngSerialize(run.rng),
    tickNumber: run.tickNumber,
    cycle: run.cycle,
    cycleProgressMs: run.cycleProgressMs,
    cycleDurationMs: run.cycleDurationMs,
    cycleEnemyBudget: run.cycleEnemyBudget,
    cycleSpawnAccumulator: run.cycleSpawnAccumulator,
    scrip: run.scrip,
    alloy: run.alloy,
    baseSentinelStats: serializeStats(run.baseSentinelStats),
    sentinelStats: serializeStats(run.sentinel.stats),
    sentinelRadius: run.sentinel.radius,
    sentinelAttackCooldown: run.sentinel.attackCooldown,
    enemies: run.enemies.map((e) => ({
      id: e.id,
      archetype: e.archetype,
      pos: { ...e.pos },
      prevPos: { ...e.prevPos },
      vel: { ...e.vel },
      hp: e.hp,
      maxHp: e.maxHp,
      radius: e.radius,
      speed: e.speed,
      contactDamage: e.contactDamage,
      alloyReward: e.alloyReward,
      state: e.state,
      spawnedAtCycle: e.spawnedAtCycle,
      attackCooldown: e.attackCooldown,
    })),
    projectiles: run.projectiles.map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      pos: { ...p.pos },
      prevPos: { ...p.prevPos },
      vel: { ...p.vel },
      damage: p.damage,
      lifetime: p.lifetime,
      radius: p.radius,
    })),
    enemyProjectiles: run.enemyProjectiles.map((p) => ({
      id: p.id,
      pos: { ...p.pos },
      prevPos: { ...p.prevPos },
      vel: { ...p.vel },
      damage: p.damage,
      lifetime: p.lifetime,
      radius: p.radius,
    })),
    spawnerState: { behemothSpawnedThisCycle: run.spawnerState.behemothSpawnedThisCycle },
    nextEntityId: run.nextEntityId,
    ended: run.ended,
    forge: { levels: { ...run.forge.levels } },
    autoProcurement: {
      unlockedTier: run.autoProcurement.unlockedTier,
      activeTier: run.autoProcurement.activeTier,
      tier1: { ...run.autoProcurement.tier1 },
      tier2: {
        channels: {
          attack: { ...run.autoProcurement.tier2.channels.attack },
          defense: { ...run.autoProcurement.tier2.channels.defense },
          utility: { ...run.autoProcurement.tier2.channels.utility },
        },
      },
      tier3: {
        enabled: { ...run.autoProcurement.tier3.enabled },
        priority: { ...run.autoProcurement.tier3.priority },
        lastBoughtTick: { ...run.autoProcurement.tier3.lastBoughtTick },
        fairnessRoundRobin: run.autoProcurement.tier3.fairnessRoundRobin,
      },
      tier4: {
        mode: run.autoProcurement.tier4.mode,
        rules: run.autoProcurement.tier4.rules.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          condition: { ...r.condition },
          actions: r.actions.map((a) => ({ ...a })),
        })),
      },
    },
    stratum: run.stratum,
    stratumScale: run.stratumScale,
    stats: { kills: run.stats.kills, damageDealt: run.stats.damageDealt },
    boons: {
      chosen: run.boons.chosen.slice(),
      multipliers: { ...run.boons.multipliers },
      flatDelta: { ...run.boons.flatDelta },
      lastOfferedAtCycle: run.boons.lastOfferedAtCycle,
    },
    startedAt: Date.now(),
  };
}

export function restoreRun(snap: RunSnapshot): RunState {
  // Start from a freshly-seeded run so we have a complete shell, then overwrite.
  const seed = BigInt(snap.seed);
  const rng = rngDeserialize(snap.rngState);

  const baseStats = deserializeStats(snap.baseSentinelStats);
  const sentinelStats = deserializeStats(snap.sentinelStats);

  const forge = createForgeState();
  // Validate every key exists in the snapshot (defends against partial migrations).
  for (const k of Object.keys(forge.levels) as UpgradeId[]) {
    forge.levels[k] = snap.forge.levels[k] ?? 0;
  }

  return {
    seed,
    rng,
    tickNumber: snap.tickNumber,
    cycle: snap.cycle,
    cycleProgressMs: snap.cycleProgressMs,
    cycleDurationMs: snap.cycleDurationMs ?? CYCLE_DURATION_SECONDS * 1000,
    cycleEnemyBudget: snap.cycleEnemyBudget,
    cycleSpawnAccumulator: snap.cycleSpawnAccumulator,
    scrip: snap.scrip,
    alloy: snap.alloy,
    baseSentinelStats: baseStats,
    sentinel: {
      pos: { x: 0, y: 0 },
      radius: snap.sentinelRadius,
      attackCooldown: snap.sentinelAttackCooldown,
      stats: sentinelStats,
    },
    enemies: snap.enemies.map((e) => ({
      id: e.id,
      archetype: e.archetype as EnemyArchetype,
      pos: { ...e.pos },
      prevPos: { ...e.prevPos },
      vel: { ...e.vel },
      hp: e.hp,
      maxHp: e.maxHp,
      radius: e.radius,
      speed: e.speed,
      contactDamage: e.contactDamage,
      alloyReward: e.alloyReward,
      state: e.state as EnemyState,
      spawnedAtCycle: e.spawnedAtCycle,
      attackCooldown: e.attackCooldown ?? 0,
    })),
    projectiles: snap.projectiles.map((p) => ({
      id: p.id,
      ownerId: "sentinel" as const, // Phase 3: only Sentinel projectiles exist
      pos: { ...p.pos },
      prevPos: { ...p.prevPos },
      vel: { ...p.vel },
      damage: p.damage,
      lifetime: p.lifetime,
      radius: p.radius,
    })),
    enemyProjectiles: (snap.enemyProjectiles ?? []).map((p) => ({
      id: p.id,
      pos: { ...p.pos },
      prevPos: { ...p.prevPos },
      vel: { ...p.vel },
      damage: p.damage,
      lifetime: p.lifetime,
      radius: p.radius,
    })),
    spawnerState: snap.spawnerState
      ? {
          behemothSpawnedThisCycle: !!snap.spawnerState.behemothSpawnedThisCycle,
          fleetSpawnedThisCycle: !!(snap.spawnerState as { fleetSpawnedThisCycle?: boolean }).fleetSpawnedThisCycle,
        }
      : { behemothSpawnedThisCycle: false, fleetSpawnedThisCycle: false },
    stratum: snap.stratum ?? 1,
    stratumScale: snap.stratumScale ?? 1.0,
    stats: {
      kills: snap.stats?.kills ?? 0,
      damageDealt: snap.stats?.damageDealt ?? 0,
    },
    nextEntityId: snap.nextEntityId,
    ended: snap.ended,
    forge,
    // Phase 10: re-init Arsenal runtime; host reattaches loadout references after restore.
    arsenals: createArsenalRuntimeState(),
    arsenalSlot: null,
    protocolSlot: null,
    augmentSlot: null,
    // Phase 11: Boons restored from snapshot; Heirloom/Construct slot refs reattached by host.
    boons: restoreBoons(snap.boons),
    heirloomSlot: null,
    constructSlot: null,
    constructs: createConstructRuntimeState(),
    wardenSlot: null,
    warden: null,
    fleetDrops: { fluxCrystals: 0, augmentFragments: 0 },
    archive: null,
    enemyHash: new EnemySpatialHash(),
    autoProcurement: snap.autoProcurement
      ? {
          unlockedTier: clampTier(snap.autoProcurement.unlockedTier),
          activeTier: clampTier(snap.autoProcurement.activeTier),
          tier1: {
            enabled: !!snap.autoProcurement.tier1.enabled,
            category: validateCategory(snap.autoProcurement.tier1.category),
          },
          tier2: restoreTier2(snap.autoProcurement.tier2),
          tier3: restoreTier3(snap.autoProcurement.tier3),
          tier4: restoreTier4(snap.autoProcurement.tier4),
          pulses: [],
        }
      : createAutoProcurementState(),
  };
}

function clampTier(n: number): 0 | AutoProcurementTier {
  if (n >= 4) return 4;
  if (n >= 3) return 3;
  if (n >= 2) return 2;
  if (n >= 1) return 1;
  return 0;
}

function restoreTier2(
  t2: { channels: Record<string, { enabled: boolean; reserve: number }> } | undefined,
): { channels: Record<UpgradeCategory, { enabled: boolean; reserve: number }> } {
  const fallback = createAutoProcurementState().tier2;
  if (!t2) return fallback;
  return {
    channels: {
      attack: {
        enabled: !!t2.channels["attack"]?.enabled,
        reserve: Math.max(0, Math.floor(t2.channels["attack"]?.reserve ?? 0)),
      },
      defense: {
        enabled: !!t2.channels["defense"]?.enabled,
        reserve: Math.max(0, Math.floor(t2.channels["defense"]?.reserve ?? 0)),
      },
      utility: {
        enabled: !!t2.channels["utility"]?.enabled,
        reserve: Math.max(0, Math.floor(t2.channels["utility"]?.reserve ?? 0)),
      },
    },
  };
}

function validateCategory(c: string): UpgradeCategory {
  if (c === "attack" || c === "defense" || c === "utility") return c;
  return "defense";
}

function restoreTier3(t3: unknown): Tier3Config {
  const fallback = createTier3Defaults();
  if (!t3 || typeof t3 !== "object") return fallback;
  const src = t3 as {
    enabled?: Record<string, unknown>;
    priority?: Record<string, unknown>;
    lastBoughtTick?: Record<string, unknown>;
    fairnessRoundRobin?: unknown;
  };
  const out = createTier3Defaults();
  for (const k of Object.keys(out.enabled) as UpgradeId[]) {
    if (src.enabled && typeof src.enabled[k] === "boolean") out.enabled[k] = src.enabled[k] as boolean;
    if (src.priority && typeof src.priority[k] === "number") {
      out.priority[k] = clampInt(src.priority[k] as number, 1, 10);
    }
    if (src.lastBoughtTick && typeof src.lastBoughtTick[k] === "number") {
      out.lastBoughtTick[k] = Math.max(0, Math.floor(src.lastBoughtTick[k] as number));
    }
  }
  if (typeof src.fairnessRoundRobin === "boolean") out.fairnessRoundRobin = src.fairnessRoundRobin;
  return out;
}

function restoreTier4(t4: unknown): Tier4Config {
  if (!t4 || typeof t4 !== "object") return { rules: [], mode: "first-match" };
  const src = t4 as { mode?: unknown; rules?: unknown };
  const mode = src.mode === "all-match" ? "all-match" : "first-match";
  const rules: Rule[] = [];
  if (Array.isArray(src.rules)) {
    for (const r of src.rules) {
      if (!r || typeof r !== "object") continue;
      const rr = r as Rule;
      if (!rr.id || !rr.name || !rr.condition || !Array.isArray(rr.actions)) continue;
      rules.push({
        id: String(rr.id),
        name: String(rr.name),
        enabled: !!rr.enabled,
        condition: { ...rr.condition },
        actions: rr.actions.map((a) => ({ ...a })),
      });
      if (rules.length >= 5) break;
    }
  }
  return { rules, mode };
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function restoreBoons(snap: RunSnapshot["boons"]): BoonRunState {
  const fresh = createBoonRunState();
  if (!snap) return fresh;
  return {
    chosen: (snap.chosen ?? []).slice() as BoonId[],
    multipliers: {
      damage: snap.multipliers?.damage ?? 1,
      attackSpeed: snap.multipliers?.attackSpeed ?? 1,
      range: snap.multipliers?.range ?? 1,
    },
    flatDelta: {
      maxHealth: snap.flatDelta?.maxHealth ?? 0,
      defensePercent: snap.flatDelta?.defensePercent ?? 0,
      lifesteal: snap.flatDelta?.lifesteal ?? 0,
      scripBonus: snap.flatDelta?.scripBonus ?? 0,
      alloyPerKill: snap.flatDelta?.alloyPerKill ?? 0,
    },
    pending: null,
    lastOfferedAtCycle: snap.lastOfferedAtCycle ?? 0,
  };
}

function serializeStats(s: typeof DEFAULT_SENTINEL_STATS): SerializedSentinelStats {
  return {
    damage: s.damage,
    attackSpeed: s.attackSpeed,
    range: s.range,
    health: s.health,
    maxHealth: s.maxHealth,
    projectileSpeed: s.projectileSpeed,
    defensePercent: s.defensePercent,
    thorns: s.thorns,
    lifesteal: s.lifesteal,
    scripBonus: s.scripBonus,
    alloyPerKill: s.alloyPerKill,
  };
}

function deserializeStats(s: SerializedSentinelStats): typeof DEFAULT_SENTINEL_STATS {
  return {
    damage: s.damage,
    attackSpeed: s.attackSpeed,
    range: s.range,
    health: s.health,
    maxHealth: s.maxHealth,
    projectileSpeed: s.projectileSpeed,
    defensePercent: s.defensePercent,
    thorns: s.thorns,
    lifesteal: s.lifesteal,
    scripBonus: s.scripBonus,
    alloyPerKill: s.alloyPerKill,
  };
}

// Used by tests; createRng kept in scope to match the production import surface.
void createRng;
