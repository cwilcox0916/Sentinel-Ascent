/**
 * Enemy AI.
 *
 * Phase 1 shipped radial inward movement only.
 * Phase 5 adds Lancer ranged behavior: stop at `stoppingDistance`, fire on cooldown.
 *
 * Each enemy retains prevPos for render interpolation.
 */

import type { EnemyProjectile, RunState } from "../types.ts";
import { nextEntityId } from "../runState.ts";
import { getEnemyDefinition } from "./definitions.ts";
import { applySlowIfAny } from "../arsenals.ts";
import { watchSlowMultiplier } from "../../meta/constructs.ts";

export function updateEnemies(run: RunState, dtSeconds: number): void {
  const sentinel = run.sentinel;

  for (const enemy of run.enemies) {
    enemy.prevPos.x = enemy.pos.x;
    enemy.prevPos.y = enemy.pos.y;

    if (enemy.state === "dying") continue;

    const dx = sentinel.pos.x - enemy.pos.x;
    const dy = sentinel.pos.y - enemy.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) continue;

    const def = getEnemyDefinition(enemy.archetype);
    const ranged = def.ranged;

    if (ranged && dist <= ranged.stoppingDistance) {
      // Hold position and attack.
      enemy.vel.x = 0;
      enemy.vel.y = 0;
      enemy.attackCooldown -= dtSeconds;
      if (enemy.attackCooldown <= 0) {
        fireEnemyProjectile(run, enemy.pos.x, enemy.pos.y, dx, dy, dist, ranged.projectileDamage, ranged.projectileSpeed);
        enemy.attackCooldown = ranged.cooldown;
      }
    } else {
      const slow = applySlowIfAny(run, enemy) * watchSlowMultiplier(run, enemy.id);
      const ux = dx / dist;
      const uy = dy / dist;
      enemy.vel.x = ux * enemy.speed * slow;
      enemy.vel.y = uy * enemy.speed * slow;
      enemy.pos.x += enemy.vel.x * dtSeconds;
      enemy.pos.y += enemy.vel.y * dtSeconds;
    }
  }
}

function fireEnemyProjectile(
  run: RunState,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  dist: number,
  damage: number,
  speed: number,
): void {
  const ux = dx / dist;
  const uy = dy / dist;
  const projectile: EnemyProjectile = {
    id: nextEntityId(run),
    pos: { x: ox, y: oy },
    prevPos: { x: ox, y: oy },
    vel: { x: ux * speed, y: uy * speed },
    damage,
    lifetime: 4.0,
    radius: 4,
  };
  run.enemyProjectiles.push(projectile);
}
