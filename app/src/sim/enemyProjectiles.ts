/**
 * Enemy projectile pipeline. Phase 5 (Lancer fires straight-line projectiles).
 *
 * Sentinel-side defense (Defense %, Lifesteal-on-kill, etc.) is applied via the
 * shared incoming-hit pipeline in sentinel/defense.ts.
 */

import type { RunState } from "./types.ts";

const KILL_BOUNDS = 700;

export function updateEnemyProjectiles(run: RunState, dtSeconds: number): void {
  for (const p of run.enemyProjectiles) {
    p.prevPos.x = p.pos.x;
    p.prevPos.y = p.pos.y;
    p.pos.x += p.vel.x * dtSeconds;
    p.pos.y += p.vel.y * dtSeconds;
    p.lifetime -= dtSeconds;
  }
}

export function resolveEnemyProjectileHits(run: RunState): void {
  const sentinel = run.sentinel;
  const stats = sentinel.stats;
  const r2 = (sentinel.radius + 4) * (sentinel.radius + 4);

  for (const p of run.enemyProjectiles) {
    if (p.lifetime <= 0) continue;
    const dx = p.pos.x - sentinel.pos.x;
    const dy = p.pos.y - sentinel.pos.y;
    if (dx * dx + dy * dy <= r2) {
      const reduced = p.damage * (1 - stats.defensePercent);
      stats.health -= reduced;
      p.lifetime = 0;
      if (stats.health <= 0) {
        stats.health = 0;
        run.ended = true;
      }
    }
  }
}

export function reapEnemyProjectiles(run: RunState): void {
  let write = 0;
  for (let read = 0; read < run.enemyProjectiles.length; read++) {
    const p = run.enemyProjectiles[read];
    if (!p) continue;
    const oob = Math.abs(p.pos.x) > KILL_BOUNDS || Math.abs(p.pos.y) > KILL_BOUNDS;
    if (p.lifetime > 0 && !oob) {
      run.enemyProjectiles[write++] = p;
    }
  }
  run.enemyProjectiles.length = write;
}
