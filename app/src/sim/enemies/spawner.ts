/**
 * Cycle spawn budget — drains the Cycle's enemy quota across its duration,
 * mixing archetypes per `normalCompositionForCycle`. Behemoths spawn once
 * per Behemoth Cycle (every 10 by default).
 *
 * Spec: docs/my_game/02-enemies-and-wave-spec.md §17 + §4
 */

import type { Enemy, EnemyArchetype, RunState } from "../types.ts";
import { nextEntityId } from "../runState.ts";
import { nextFloat } from "../rng.ts";
import {
  BEHEMOTH,
  DISRUPTOR,
  OVERSEER,
  RESONANT,
  type EnemyDefinition,
  fleetForCycle,
  isBehemothCycle,
  isFleetCycle,
  normalCompositionForCycle,
} from "./definitions.ts";

const SPAWN_RING_RADIUS = 480;

export function updateSpawner(run: RunState, dtSeconds: number): void {
  // Schedule the Behemoth: spawn once at the start of any Behemoth Cycle.
  if (isBehemothCycle(run.cycle) && !run.spawnerState.behemothSpawnedThisCycle) {
    spawnEnemy(run, BEHEMOTH);
    run.spawnerState.behemothSpawnedThisCycle = true;
  }
  // Phase 14: Fleet scheduling. Spawn one fleet enemy per fleet Cycle.
  if (isFleetCycle(run.cycle) && !run.spawnerState.fleetSpawnedThisCycle) {
    const fleetDef = fleetArchetypeDef(fleetForCycle(run.cycle));
    spawnEnemy(run, fleetDef);
    run.spawnerState.fleetSpawnedThisCycle = true;
  }

  if (run.cycleEnemyBudget <= 0) return;

  const cycleSeconds = run.cycleDurationMs / 1000;
  const remaining = Math.max(0.001, cycleSeconds - run.cycleProgressMs / 1000);
  const spawnRate = run.cycleEnemyBudget / remaining;
  run.cycleSpawnAccumulator += spawnRate * dtSeconds;

  while (run.cycleSpawnAccumulator >= 1 && run.cycleEnemyBudget > 0) {
    const def = pickArchetype(run);
    spawnEnemy(run, def);
    run.cycleSpawnAccumulator -= 1;
    run.cycleEnemyBudget -= 1;
  }
}

function fleetArchetypeDef(arch: EnemyArchetype): EnemyDefinition {
  if (arch === "disruptor") return DISRUPTOR;
  if (arch === "overseer") return OVERSEER;
  return RESONANT;
}

function pickArchetype(run: RunState): EnemyDefinition {
  const composition = normalCompositionForCycle(run.cycle);
  let totalWeight = 0;
  for (const def of composition) totalWeight += def.spawnWeight ?? 1;
  const roll = nextFloat(run.rng) * totalWeight;
  let cumulative = 0;
  for (const def of composition) {
    cumulative += def.spawnWeight ?? 1;
    if (roll <= cumulative) return def;
  }
  return composition[composition.length - 1] ?? composition[0]!;
}

function spawnEnemy(run: RunState, def: EnemyDefinition): void {
  const angle = nextFloat(run.rng) * Math.PI * 2;
  const ring = def.archetype === "behemoth" ? SPAWN_RING_RADIUS + 60 : SPAWN_RING_RADIUS;
  const pos = {
    x: Math.cos(angle) * ring,
    y: Math.sin(angle) * ring,
  };
  const cycleScale = scaleForCycle(run.cycle, def.archetype);
  const totalScale = cycleScale * run.stratumScale;

  const enemy: Enemy = {
    id: nextEntityId(run),
    archetype: def.archetype,
    pos,
    prevPos: { ...pos },
    vel: { x: 0, y: 0 },
    hp: def.baseHp * totalScale,
    maxHp: def.baseHp * totalScale,
    radius: def.radius,
    speed: def.baseSpeed,
    contactDamage: def.baseContactDamage * totalScale,
    // Scale rewards sub-linearly so higher Strata aren't trivially richer per-enemy.
    alloyReward: Math.max(1, Math.floor(def.baseAlloyReward * Math.sqrt(run.stratumScale))),
    state: "approaching",
    spawnedAtCycle: run.cycle,
    attackCooldown: def.ranged ? def.ranged.cooldown * 0.4 : 0,
  };
  run.enemies.push(enemy);
}

/**
 * Per-Cycle scaling. Phase 5 keeps it simple — Behemoths grow faster per Cycle
 * than normals so they stay threatening as the player upgrades.
 *
 * Full per-Stratum scaling lands in Phase 7 (Hangar / Stratum picker).
 */
function scaleForCycle(cycle: number, archetype: EnemyArchetype): number {
  if (archetype === "behemoth") {
    return 1 + (cycle - 1) * 0.18;
  }
  return 1 + (cycle - 1) * 0.08;
}
