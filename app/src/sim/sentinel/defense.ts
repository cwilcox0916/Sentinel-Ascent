/**
 * Incoming-hit pipeline — Phase 2.
 * Now applies Defense %, Thorns, and Lifesteal from in-run Forge upgrades.
 * Defense Absolute, Barrier, Repair Kits, Resilience Surge land in Phase 5+.
 *
 * Spec: docs/my_game/01-core-runtime-and-combat-spec.md §9
 */

import type { RunState } from "../types.ts";

export function resolveSentinelContact(run: RunState): void {
  const sentinel = run.sentinel;
  const stats = sentinel.stats;

  for (const enemy of run.enemies) {
    if (enemy.state === "dying") continue;
    const dx = enemy.pos.x - sentinel.pos.x;
    const dy = enemy.pos.y - sentinel.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= sentinel.radius + enemy.radius) {
      const reduced = enemy.contactDamage * (1 - stats.defensePercent);
      stats.health -= reduced;

      // Thorns: enemy takes return damage on contact (the enemy is going to die
      // from contact this tick anyway — Thorns matters more once non-suicide
      // contact patterns exist in Phase 5).
      if (stats.thorns > 0) {
        enemy.hp -= stats.thorns;
      }
      enemy.state = "dying";
      enemy.hp = 0;

      // Lifesteal off the damage dealt (the enemy's full HP, since contact kills it).
      if (stats.lifesteal > 0) {
        stats.health = Math.min(
          stats.maxHealth,
          stats.health + enemy.maxHp * stats.lifesteal,
        );
      }

      if (stats.health <= 0) {
        stats.health = 0;
        run.ended = true;
      }
    }
  }
}
