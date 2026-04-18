/**
 * Fixed-step simulation tick. Order matches docs/my_game/01-core-runtime-and-combat-spec.md §4.
 *
 * Auto-Procurement evaluation (step 5 in the spec) is a placeholder until Phase 4.
 */

import type { RunState } from "./types.ts";
import { enemyBudgetForCycle } from "./runState.ts";
import { updateSpawner } from "./enemies/spawner.ts";
import { updateEnemies } from "./enemies/ai.ts";
import { updateSentinelFiring } from "./sentinel/firing.ts";
import { resolveSentinelContact } from "./sentinel/defense.ts";
import { evaluateAutoProcurement } from "./autoProcurement.ts";
import { evaluateArsenals } from "./arsenals.ts";
import { evaluateConstructs } from "../meta/constructs.ts";
import { maybeOfferBoons } from "../meta/boons.ts";
import { evaluateWarden, createWardenRuntimeState } from "../meta/warden.ts";
import { rebuildEnemyHash } from "./spatialHash.ts";
import {
  updateProjectiles,
  resolveProjectileHits,
  reapDeadProjectiles,
  reapDeadEnemies,
} from "./projectiles.ts";
import {
  updateEnemyProjectiles,
  resolveEnemyProjectileHits,
  reapEnemyProjectiles,
} from "./enemyProjectiles.ts";

export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;

export function simulateTick(run: RunState): void {
  if (run.ended) return;
  // Phase 11: pending Boon offer freezes the sim so the player can decide.
  if (run.boons?.pending) return;

  const dt = TICK_DT;

  //  1. Advance Cycle clock
  advanceCycle(run, dt);

  //  2. Spawn enemies according to Cycle budget
  updateSpawner(run, dt);

  //  3. Update enemy AI / movement
  updateEnemies(run, dt);

  // Phase 15: rebuild the enemy spatial hash once per tick AFTER movement has
  // stabilized, so downstream queries (firing, collisions, arsenals) see
  // current positions.
  rebuildEnemyHash(run.enemyHash, run.enemies);

  //  4. Move enemy projectiles
  updateEnemyProjectiles(run, dt);

  //  5. Auto-Procurement evaluation — deterministic position per spec §5
  evaluateAutoProcurement(run);

  //  6. Sentinel attack
  updateSentinelFiring(run, dt);

  //  7. (Sentries / Charges — Phase 5+)
  //  8. Arsenals auto-fire (Phase 10)
  evaluateArsenals(run);
  //  8b. Constructs — timed + passive aura (Phase 11)
  evaluateConstructs(run, dt);
  //  8c. Warden Subroutines (Phase 13)
  if (run.wardenSlot && !run.warden) run.warden = createWardenRuntimeState();
  evaluateWarden(run, dt);

  //  9. Move + resolve projectile hits
  updateProjectiles(run, dt);
  resolveProjectileHits(run);

  // 10. Sentinel contact damage + ranged enemy projectile hits + Thorns
  resolveEnemyProjectileHits(run);
  resolveSentinelContact(run);

  // 11. Reap dead, grant rewards
  reapDeadEnemies(run);
  reapDeadProjectiles(run);
  reapEnemyProjectiles(run);

  run.tickNumber += 1;
}

function advanceCycle(run: RunState, dt: number): void {
  run.cycleProgressMs += dt * 1000;
  if (run.cycleProgressMs >= run.cycleDurationMs) {
    run.cycle += 1;
    run.cycleProgressMs = 0;
    run.cycleEnemyBudget = enemyBudgetForCycle(run.cycle);
    run.cycleSpawnAccumulator = 0;
    run.spawnerState.behemothSpawnedThisCycle = false;
    run.spawnerState.fleetSpawnedThisCycle = false;
    // Phase 11: offer Boons every 25 Cycles.
    maybeOfferBoons(run);
  }
}
