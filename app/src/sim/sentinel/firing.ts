/**
 * Sentinel firing model — Phase 1.
 * - Acquires nearest-to-center enemy in range
 * - Fires one cyan projectile per Attack Speed tick toward that target
 * Multishot, Bounce, Crit etc. land in Phase 2.
 *
 * Spec: docs/my_game/01-core-runtime-and-combat-spec.md §7
 */

import type { Enemy, Projectile, RunState } from "../types.ts";
import { nextEntityId } from "../runState.ts";

export function updateSentinelFiring(run: RunState, dtSeconds: number): void {
  const sentinel = run.sentinel;
  sentinel.attackCooldown -= dtSeconds;
  if (sentinel.attackCooldown > 0) return;

  const target = acquireTarget(run);
  if (!target) {
    sentinel.attackCooldown = 0; // ready when an enemy enters range
    return;
  }

  const dx = target.pos.x - sentinel.pos.x;
  const dy = target.pos.y - sentinel.pos.y;
  const dist = Math.hypot(dx, dy) || 1;

  const projectile: Projectile = {
    id: nextEntityId(run),
    ownerId: "sentinel",
    pos: { x: sentinel.pos.x, y: sentinel.pos.y },
    prevPos: { x: sentinel.pos.x, y: sentinel.pos.y },
    vel: {
      x: (dx / dist) * sentinel.stats.projectileSpeed,
      y: (dy / dist) * sentinel.stats.projectileSpeed,
    },
    damage: sentinel.stats.damage,
    lifetime: 2.0,
    radius: 3,
  };
  run.projectiles.push(projectile);

  sentinel.attackCooldown = 1 / sentinel.stats.attackSpeed;
}

function acquireTarget(run: RunState): Enemy | null {
  const range = run.sentinel.stats.range;
  // Phase 15: O(1)-ish via spatial hash ring-search.
  return run.enemyHash.queryNearest(run.sentinel.pos.x, run.sentinel.pos.y, range);
}
