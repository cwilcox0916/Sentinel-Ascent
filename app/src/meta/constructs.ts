/**
 * Constructs — unlockable assist drones.
 *
 * Spec: docs/my_game/04-progression-systems.md §11.
 *
 * Phase 11 ships 3 starter Constructs:
 *   - Storm Construct: periodic chain-lightning (every 6s, deals AoE damage in a random arc)
 *   - Forge Construct: passive Alloy/Kill bonus while equipped
 *   - Watch Construct: passive slow on enemies in a small radius (low intensity, no cooldown)
 *
 * Up to 1 equipped at launch (the Order Shop in Phase 13 will expand slot count).
 */

import type { Enemy, RunState, SentinelStats } from "../sim/types.ts";
import { nextFloat } from "../sim/rng.ts";
import { nextEntityId } from "../sim/runState.ts";

export type ConstructId = "storm" | "forge" | "watch";

export type ConstructDefinition = {
  id: ConstructId;
  name: string;
  description: string;
  /** Optional passive stat layer (Forge Construct). */
  applyStat?: (out: SentinelStats) => void;
  /** Optional passive aura effect per tick (Watch Construct). */
  tickPassive?: (run: RunState) => void;
  /** Optional timed effect (Storm Construct). Cooldown stored in run.constructs. */
  timedCooldownSec?: number;
  timedFire?: (run: RunState) => void;
};

const STORM_RADIUS = 220;
const STORM_DAMAGE_BASE = 35;
const STORM_BOLTS = 3;

const WATCH_RADIUS = 140;
const WATCH_SLOW = 0.75; // to 75% of speed

const CONSTRUCTS: ConstructDefinition[] = [
  {
    id: "storm",
    name: "Storm Construct",
    description: "Periodic chain-lightning arcs hit 3 random enemies every 6 seconds.",
    timedCooldownSec: 6,
    timedFire: (run) => {
      const live = run.enemies.filter((e) => e.state !== "dying" && isWithin(e, STORM_RADIUS));
      if (live.length === 0) return;
      for (let i = 0; i < STORM_BOLTS && live.length > 0; i++) {
        const ix = Math.floor(nextFloat(run.rng) * live.length);
        const target = live.splice(ix, 1)[0]!;
        const dealt = Math.min(STORM_DAMAGE_BASE, target.hp);
        target.hp -= STORM_DAMAGE_BASE;
        run.stats.damageDealt += dealt;
        if (target.hp <= 0) target.state = "dying";
        // Visual: spawn a short-lived projectile so the renderer draws an arc.
        run.projectiles.push({
          id: nextEntityId(run),
          ownerId: "sentinel",
          pos: { x: run.sentinel.pos.x, y: run.sentinel.pos.y },
          prevPos: { x: run.sentinel.pos.x, y: run.sentinel.pos.y },
          vel: { x: 0, y: 0 },
          damage: 0,
          lifetime: 0.15,
          radius: 2,
        });
      }
    },
  },
  {
    id: "forge",
    name: "Forge Construct",
    description: "Passive +3 Alloy/Kill while equipped.",
    applyStat: (o) => { o.alloyPerKill += 3; },
  },
  {
    id: "watch",
    name: "Watch Construct",
    description: "Slows enemies within 140 units by 25%.",
    tickPassive: (run) => {
      const rSq = WATCH_RADIUS * WATCH_RADIUS;
      const s = run.constructs;
      if (!s) return;
      for (const e of run.enemies) {
        if (e.state === "dying") continue;
        const dx = e.pos.x - run.sentinel.pos.x;
        const dy = e.pos.y - run.sentinel.pos.y;
        if (dx * dx + dy * dy <= rSq) {
          // Reuse the arsenals slow map — the enemy AI multiplies speed by arsenals.slowMultiplier
          // when slowedUntil has the id. Watch's slow is gentler, so we use a separate map.
          s.watchSlowedUntil.set(e.id, 0.2); // 200ms refresh; AI checks per-tick
        }
      }
    },
  },
];

export function listConstructs(): ReadonlyArray<ConstructDefinition> {
  return CONSTRUCTS;
}

export function getConstruct(id: ConstructId): ConstructDefinition {
  const c = CONSTRUCTS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown Construct: ${id}`);
  return c;
}

function isWithin(e: Enemy, radius: number): boolean {
  const d = e.pos.x * e.pos.x + e.pos.y * e.pos.y;
  return d <= radius * radius;
}

/** Persistent slot state (on SaveSlot). */
export type ConstructSlotState = {
  owned: Record<ConstructId, boolean>;
  /** Single-slot equip at launch. Phase 13 expands. */
  equipped: ConstructId | null;
};

export function createConstructSlotState(): ConstructSlotState {
  const owned = {} as Record<ConstructId, boolean>;
  for (const c of CONSTRUCTS) owned[c.id] = false;
  return { owned, equipped: null };
}

/** Per-run runtime state. */
export type ConstructRuntimeState = {
  stormCooldown: number;
  /** Enemy id → seconds of slow remaining (refreshed every tick while in radius). */
  watchSlowedUntil: Map<number, number>;
};

export function createConstructRuntimeState(): ConstructRuntimeState {
  return { stormCooldown: 0, watchSlowedUntil: new Map() };
}

/** Apply construct passive stat layer (Forge Construct only). */
export function applyConstructStats(slot: ConstructSlotState, out: SentinelStats): void {
  const id = slot.equipped;
  if (!id || !slot.owned[id]) return;
  getConstruct(id).applyStat?.(out);
}

/** Called from sim tick to drive timed + passive constructs. */
export function evaluateConstructs(run: RunState, dtSeconds: number): void {
  const rt = run.constructs;
  const slot = run.constructSlot;
  if (!rt || !slot) return;
  const id = slot.equipped;
  if (!id || !slot.owned[id]) return;
  const def = getConstruct(id);

  // Decay watch slows.
  for (const [eid, t] of rt.watchSlowedUntil) {
    const next = t - dtSeconds;
    if (next <= 0) rt.watchSlowedUntil.delete(eid);
    else rt.watchSlowedUntil.set(eid, next);
  }

  if (def.tickPassive) def.tickPassive(run);

  if (def.timedFire && def.timedCooldownSec) {
    rt.stormCooldown -= dtSeconds;
    if (rt.stormCooldown <= 0) {
      def.timedFire(run);
      rt.stormCooldown = def.timedCooldownSec;
    }
  }
}

/** Apply slow from Watch Construct on enemy AI. Returns 1 if no slow. */
export function watchSlowMultiplier(run: RunState, enemyId: number): number {
  const rt = run.constructs;
  if (!rt) return 1;
  if (rt.watchSlowedUntil.has(enemyId)) return WATCH_SLOW;
  return 1;
}

export function equipConstruct(slot: ConstructSlotState, id: ConstructId | null): void {
  if (id != null && !slot.owned[id]) return;
  slot.equipped = id;
}

export function grantConstruct(slot: ConstructSlotState, id: ConstructId): void {
  slot.owned[id] = true;
}
