/**
 * Arsenals — sim-tick evaluation.
 *
 * Phase 10 implements three Arsenals:
 *   - Arc Cascade: PASSIVE — on any Sentinel projectile hit, roll a proc chance;
 *     on success, deal bonus damage to the hit enemy plus 2 nearest neighbors.
 *   - Seeker Salvo: TIMED — every cooldownSec, spawn N missiles that home in on
 *     the N nearest enemies.
 *   - Stasis Field: TIMED — every cooldownSec, slow all enemies within a radius
 *     for a duration.
 *
 * Spec: docs/my_game/01-core-runtime-and-combat-spec.md §11, docs/my_game/04-progression-systems.md §8.
 *
 * Determinism: cooldown timers are float-driven at fixed 60 Hz, proc rolls use
 * the run's seeded PRNG (via nextFloat). Identical seed + identical loadout →
 * identical arsenal activations.
 */

import type { Enemy, Projectile, RunState } from "./types.ts";
import { TICK_DT } from "./tick.ts";
import { nextEntityId } from "./runState.ts";
import { effectiveCooldownSec, getArsenal, listArsenals, type ArsenalId } from "../meta/arsenals.ts";
import { nextFloat } from "./rng.ts";

export type ArsenalRuntimeState = {
  cooldowns: Record<ArsenalId, number>; // seconds remaining
  /** Slow debuff: enemyId → seconds remaining of slow effect. Stasis Field populates this. */
  slowedUntil: Map<number, number>;
  /** Multiplier applied to enemy speed while in slowedUntil. */
  slowMultiplier: number;
};

export function createArsenalRuntimeState(): ArsenalRuntimeState {
  const cooldowns = {} as Record<ArsenalId, number>;
  for (const a of listArsenals()) cooldowns[a.id] = 0;
  return { cooldowns, slowedUntil: new Map(), slowMultiplier: 1.0 };
}

/**
 * Per-tick Arsenal evaluation — called from tick.ts step 8 (after Sentinel fires,
 * before projectiles move).
 */
export function evaluateArsenals(run: RunState): void {
  const ars = run.arsenals;
  if (!ars) return;

  // Decay slow debuffs.
  for (const [id, t] of ars.slowedUntil) {
    const next = t - TICK_DT;
    if (next <= 0) ars.slowedUntil.delete(id);
    else ars.slowedUntil.set(id, next);
  }

  const slot = getArsenalSlotState(run);
  if (!slot) return;

  // Seeker Salvo
  const seekerLevel = slot.levels["seeker-salvo"];
  if (slot.equipped["seeker-salvo"] && seekerLevel > 0) {
    ars.cooldowns["seeker-salvo"] -= TICK_DT;
    if (ars.cooldowns["seeker-salvo"] <= 0) {
      const def = getArsenal("seeker-salvo");
      fireSeekerSalvo(run, seekerLevel);
      ars.cooldowns["seeker-salvo"] = effectiveCooldownSec(def, seekerLevel);
    }
  }

  // Stasis Field
  const stasisLevel = slot.levels["stasis-field"];
  if (slot.equipped["stasis-field"] && stasisLevel > 0) {
    ars.cooldowns["stasis-field"] -= TICK_DT;
    if (ars.cooldowns["stasis-field"] <= 0) {
      const def = getArsenal("stasis-field");
      fireStasisField(run, stasisLevel);
      ars.cooldowns["stasis-field"] = effectiveCooldownSec(def, stasisLevel);
    }
  }

  // Arc Cascade is passive — handled in projectiles.ts on-hit path.
}

/** Get reference to the ArsenalSlotState the host attached to RunState. */
function getArsenalSlotState(run: RunState): import("../meta/arsenals.ts").ArsenalSlotState | null {
  return run.arsenalSlot ?? null;
}

function fireSeekerSalvo(run: RunState, level: number): void {
  const count = 2 + Math.floor(level / 2);
  const damage = 10 + 6 * level;
  const targets = nearestEnemies(run, count);
  if (targets.length === 0) return;
  for (const t of targets) {
    const dx = t.pos.x - run.sentinel.pos.x;
    const dy = t.pos.y - run.sentinel.pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 520;
    const p: Projectile = {
      id: nextEntityId(run),
      ownerId: "sentinel",
      pos: { x: run.sentinel.pos.x, y: run.sentinel.pos.y },
      prevPos: { x: run.sentinel.pos.x, y: run.sentinel.pos.y },
      vel: { x: (dx / dist) * speed, y: (dy / dist) * speed },
      damage,
      lifetime: 1.5,
      radius: 4,
    };
    run.projectiles.push(p);
  }
}

function fireStasisField(run: RunState, level: number): void {
  const ars = run.arsenals;
  if (!ars) return;
  const radius = 180;
  const radiusSq = radius * radius;
  const duration = 2 + 0.2 * level;
  ars.slowMultiplier = Math.max(0.15, 1 - (0.4 + 0.05 * level));
  for (const e of run.enemies) {
    if (e.state === "dying") continue;
    // Phase 14: fleet has 50% Stasis resistance (spec §10) — we apply half duration.
    const dx = e.pos.x - run.sentinel.pos.x;
    const dy = e.pos.y - run.sentinel.pos.y;
    if (dx * dx + dy * dy <= radiusSq) {
      const effective = isFleetArch(e.archetype) ? duration * 0.5 : duration;
      ars.slowedUntil.set(e.id, effective);
    }
  }
}

function isFleetArch(archetype: string): boolean {
  return archetype === "disruptor" || archetype === "overseer" || archetype === "resonant";
}

function nearestEnemies(run: RunState, count: number): Enemy[] {
  const live = run.enemies.filter((e) => e.state !== "dying");
  live.sort((a, b) => {
    const da = a.pos.x * a.pos.x + a.pos.y * a.pos.y;
    const db = b.pos.x * b.pos.x + b.pos.y * b.pos.y;
    return da - db;
  });
  return live.slice(0, count);
}

/** Arc Cascade: called from projectile hit-resolution. Returns bonus damage applied. */
export function onProjectileHit(run: RunState, hitEnemy: Enemy): number {
  const slot = getArsenalSlotState(run);
  const ars = run.arsenals;
  if (!slot || !ars) return 0;
  const level = slot.levels["arc-cascade"];
  if (!slot.equipped["arc-cascade"] || level <= 0) return 0;

  const procChance = Math.min(1, (5 + 3 * level) / 100);
  const roll = nextFloat(run.rng);
  if (roll > procChance) return 0;

  const bonus = 5 + 3 * level;
  let applied = 0;
  // Damage the primary target's 2 nearest neighbors (the primary already took the base shot).
  const neighbors = run.enemies
    .filter((e) => e.id !== hitEnemy.id && e.state !== "dying")
    .map((e) => {
      const dx = e.pos.x - hitEnemy.pos.x;
      const dy = e.pos.y - hitEnemy.pos.y;
      return { e, dSq: dx * dx + dy * dy };
    })
    .sort((a, b) => a.dSq - b.dSq)
    .slice(0, 2);
  for (const { e } of neighbors) {
    const dealt = Math.min(bonus, e.hp);
    e.hp -= bonus;
    applied += dealt;
    if (e.hp <= 0) e.state = "dying";
  }
  return applied;
}

/** Apply current slow debuff to enemy speed. Called from enemy AI step. */
export function applySlowIfAny(run: RunState, enemy: Enemy): number {
  const ars = run.arsenals;
  if (!ars) return 1;
  if (ars.slowedUntil.has(enemy.id)) return ars.slowMultiplier;
  return 1;
}
