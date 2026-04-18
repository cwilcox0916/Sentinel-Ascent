/**
 * Projectile movement + hit resolution.
 * Phase 1: simple linear motion, kill enemy on contact, despawn after lifetime.
 */

import type { Enemy, RunState } from "./types.ts";
import { grantKillRewards } from "./rewards.ts";
import { onProjectileHit } from "./arsenals.ts";

const KILL_BOUNDS = 700; // despawn projectiles that fly off-grid

// Phase 15: scratch buffer for hash radius queries — avoids allocating per projectile.
const HIT_SCRATCH: Enemy[] = [];

export function updateProjectiles(run: RunState, dtSeconds: number): void {
  for (const p of run.projectiles) {
    p.prevPos.x = p.pos.x;
    p.prevPos.y = p.pos.y;
    p.pos.x += p.vel.x * dtSeconds;
    p.pos.y += p.vel.y * dtSeconds;
    p.lifetime -= dtSeconds;
  }
}

export function resolveProjectileHits(run: RunState): void {
  for (const p of run.projectiles) {
    if (p.lifetime <= 0) continue;
    // Phase 15: hash broadphase — query a radius equal to the largest enemy
    // radius (28 for Behemoth) + projectile radius.
    const queryRadius = p.radius + 28;
    run.enemyHash.queryRadius(p.pos.x, p.pos.y, queryRadius, HIT_SCRATCH);
    for (const enemy of HIT_SCRATCH) {
      if (enemy.state === "dying") continue;
      const dx = enemy.pos.x - p.pos.x;
      const dy = enemy.pos.y - p.pos.y;
      const r = enemy.radius + p.radius;
      if (dx * dx + dy * dy <= r * r) {
        const dealt = Math.min(p.damage, Math.max(0, enemy.hp));
        enemy.hp -= p.damage;
        run.stats.damageDealt += dealt;
        // Phase 10: Arc Cascade passive proc — may deal bonus AoE.
        const bonus = onProjectileHit(run, enemy);
        if (bonus > 0) run.stats.damageDealt += bonus;
        p.lifetime = 0; // consume
        if (enemy.hp <= 0) {
          enemy.state = "dying";
        }
        break;
      }
    }
  }
}

export function reapDeadProjectiles(run: RunState): void {
  // In-place filter to keep allocations down.
  let write = 0;
  for (let read = 0; read < run.projectiles.length; read++) {
    const p = run.projectiles[read];
    if (!p) continue;
    const oob =
      Math.abs(p.pos.x) > KILL_BOUNDS || Math.abs(p.pos.y) > KILL_BOUNDS;
    if (p.lifetime > 0 && !oob) {
      run.projectiles[write++] = p;
    }
  }
  run.projectiles.length = write;
}

export function reapDeadEnemies(run: RunState): void {
  let write = 0;
  for (let read = 0; read < run.enemies.length; read++) {
    const e = run.enemies[read];
    if (!e) continue;
    if (e.state !== "dying") {
      run.enemies[write++] = e;
    } else {
      grantKillRewards(run, e);
    }
  }
  run.enemies.length = write;
}
