/**
 * Warden + Subroutines — single-player conversion of the Guardian + Chips system.
 *
 * Spec: docs/my_game/04-progression-systems.md §13.
 *
 * Phase 13 ships:
 *   - Auto-unlock at Stratum 3 / Cycle 100 (`isWardenUnlocked(slot)` helper)
 *   - 3 launch Subroutines: Strike, Bounty, Fetch — each with deterministic sim effect
 *   - 3 Subroutine slots (capacity scales with Subnodes spent on slot unlocks)
 *   - Per-Subroutine level ranks via Subnodes
 *
 * Sim effects:
 *   - Strike: every 4s, deal 30 + 8*L damage to the enemy with the most prior damage taken
 *   - Bounty: marks enemies inside 200 unit radius — marked enemies grant +25 + 5*L Alloy on death
 *   - Fetch: passive +5% chance per L on Behemoth-kill to drop a small Prism cache (granted via slot)
 */

import type { Enemy, RunState, SentinelStats } from "../sim/types.ts";
import { nextEntityId } from "../sim/runState.ts";

export type SubroutineId = "strike" | "bounty" | "fetch";

export const SUBROUTINE_MAX_LEVEL = 5;
export const WARDEN_UNLOCK_STRATUM = 3;
export const WARDEN_UNLOCK_CYCLE = 100;

/** Subnodes required to unlock a Subroutine slot. */
export const SLOT_UNLOCK_COSTS = [100, 200, 300];
export const SUBROUTINE_LEVEL_COST_BASE = 50;

export type SubroutineDefinition = {
  id: SubroutineId;
  name: string;
  description: string;
  /** Optional per-tick effect. */
  tick?: (run: RunState, level: number, dt: number) => void;
  /** Optional Sentinel-stat layer. */
  applyStat?: (out: SentinelStats, level: number) => void;
  /** Optional behemoth-kill trigger (grants something). */
  onBehemothKill?: (run: RunState, level: number) => void;
  formatEffect: (level: number) => string;
};

const STRIKE_COOLDOWN = 4; // seconds
const BOUNTY_RADIUS = 200;

const SUBROUTINES: SubroutineDefinition[] = [
  {
    id: "strike",
    name: "Strike",
    description: "Warden attacks the most-damaged enemy on a fixed 4s cooldown.",
    tick: (run, level, dt) => {
      const wt = ensureWardenRuntime(run);
      wt.strikeCooldown -= dt;
      if (wt.strikeCooldown > 0) return;
      const target = mostDamagedEnemy(run);
      if (!target) {
        wt.strikeCooldown = 0;
        return;
      }
      const dmg = 30 + 8 * level;
      const dealt = Math.min(dmg, target.hp);
      target.hp -= dmg;
      run.stats.damageDealt += dealt;
      if (target.hp <= 0) target.state = "dying";
      wt.strikeCooldown = STRIKE_COOLDOWN;
      // Visual marker — short-lived projectile from sentinel to target so the
      // existing renderer shows a flicker.
      run.projectiles.push({
        id: nextEntityId(run),
        ownerId: "sentinel",
        pos: { x: run.sentinel.pos.x, y: run.sentinel.pos.y },
        prevPos: { x: run.sentinel.pos.x, y: run.sentinel.pos.y },
        vel: { x: 0, y: 0 },
        damage: 0,
        lifetime: 0.18,
        radius: 2,
      });
    },
    formatEffect: (l) => `${30 + 8 * l} damage / 4s on the most-damaged enemy`,
  },
  {
    id: "bounty",
    name: "Bounty",
    description: "Marks nearby non-common enemies; marked enemies grant bonus Alloy on death.",
    tick: (run, level) => {
      const wt = ensureWardenRuntime(run);
      const rSq = BOUNTY_RADIUS * BOUNTY_RADIUS;
      for (const e of run.enemies) {
        if (e.state === "dying") continue;
        if (e.archetype === "drone") continue; // commons don't qualify
        const dx = e.pos.x - run.sentinel.pos.x;
        const dy = e.pos.y - run.sentinel.pos.y;
        if (dx * dx + dy * dy <= rSq) wt.bountyMarked.set(e.id, 25 + 5 * level);
      }
    },
    formatEffect: (l) => `+${25 + 5 * l} Alloy bonus on marked-enemy kill`,
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Behemoth kills have a chance to drop a small Prism cache.",
    onBehemothKill: () => { /* grant happens host-side via wardenOnBehemothKill */ },
    formatEffect: (l) => `${5 * l}% chance per Behemoth kill: +10 Prisms`,
  },
];

export function listSubroutines(): ReadonlyArray<SubroutineDefinition> {
  return SUBROUTINES;
}

export function getSubroutine(id: SubroutineId): SubroutineDefinition {
  const s = SUBROUTINES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown Subroutine: ${id}`);
  return s;
}

/** Persistent Warden state on the slot. */
export type WardenSlotState = {
  unlocked: boolean;
  unlockedSlots: number; // 0..3
  /** Owned subroutines (by spending Subnodes for the slot, or via Order Shop). */
  owned: Record<SubroutineId, boolean>;
  /** Per-subroutine level. */
  levels: Record<SubroutineId, number>;
  /** Equipped subroutines (in slot order). */
  equipped: (SubroutineId | null)[];
};

export function createWardenSlotState(): WardenSlotState {
  const owned = {} as Record<SubroutineId, boolean>;
  const levels = {} as Record<SubroutineId, number>;
  for (const s of SUBROUTINES) {
    owned[s.id] = false;
    levels[s.id] = 0;
  }
  // First Subroutine (Strike) is granted on Warden unlock as a starter.
  return { unlocked: false, unlockedSlots: 0, owned, levels, equipped: [null, null, null] };
}

export type WardenRuntimeState = {
  strikeCooldown: number;
  bountyMarked: Map<number, number>; // enemyId → bonus Alloy
};

export function createWardenRuntimeState(): WardenRuntimeState {
  return { strikeCooldown: STRIKE_COOLDOWN, bountyMarked: new Map() };
}

function ensureWardenRuntime(run: RunState): WardenRuntimeState {
  if (!run.warden) run.warden = createWardenRuntimeState();
  return run.warden;
}

function mostDamagedEnemy(run: RunState): Enemy | null {
  let best: Enemy | null = null;
  let bestRatio = 0;
  for (const e of run.enemies) {
    if (e.state === "dying") continue;
    const r = 1 - e.hp / Math.max(1, e.maxHp);
    if (r > bestRatio) {
      bestRatio = r;
      best = e;
    }
  }
  return best;
}

/** Called every sim tick (after constructs). */
export function evaluateWarden(run: RunState, dt: number): void {
  const slot = run.wardenSlot;
  if (!slot || !slot.unlocked) return;
  for (const id of slot.equipped) {
    if (!id) continue;
    const lvl = slot.levels[id];
    if (lvl <= 0) continue;
    getSubroutine(id).tick?.(run, lvl, dt);
  }
}

/** Bonus Alloy on enemy death from Bounty marker. */
export function wardenAlloyBonus(run: RunState, enemyId: number): number {
  const wt = run.warden;
  if (!wt) return 0;
  return wt.bountyMarked.get(enemyId) ?? 0;
}

/** Called when a Behemoth dies — Fetch may grant Prisms. */
export function wardenOnBehemothKill(
  run: RunState,
  currencies: { prisms: number },
): number {
  const slot = run.wardenSlot;
  if (!slot || !slot.unlocked) return 0;
  const fetchSlot = slot.equipped.find((e) => e === "fetch");
  if (!fetchSlot) return 0;
  const lvl = slot.levels["fetch"];
  if (lvl <= 0) return 0;
  // Deterministic via run.rng.
  const roll = (() => {
    // Inline import to avoid circular: read run.rng directly.
    // Use the existing nextFloat helper.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nextFloat } = require("../sim/rng.ts") as { nextFloat: (r: typeof run.rng) => number };
    return nextFloat(run.rng);
  })();
  if (roll <= 0.05 * lvl) {
    currencies.prisms += 10;
    return 10;
  }
  return 0;
}

export function isWardenUnlockEligible(highestCycle: number, highestStratum: number): boolean {
  return highestStratum >= WARDEN_UNLOCK_STRATUM && highestCycle >= WARDEN_UNLOCK_CYCLE;
}

export function unlockWarden(slot: WardenSlotState, currencies: { subnodes: number }): "ok" | "insufficient" {
  if (slot.unlocked) return "ok";
  const cost = SLOT_UNLOCK_COSTS[0]!;
  if (currencies.subnodes < cost) return "insufficient";
  currencies.subnodes -= cost;
  slot.unlocked = true;
  slot.unlockedSlots = 1;
  // Grant Strike as a starter Subroutine.
  slot.owned["strike"] = true;
  slot.levels["strike"] = 1;
  slot.equipped[0] = "strike";
  return "ok";
}

export function unlockNextSlot(slot: WardenSlotState, currencies: { subnodes: number }): "ok" | "max" | "insufficient" {
  if (slot.unlockedSlots >= SLOT_UNLOCK_COSTS.length) return "max";
  const cost = SLOT_UNLOCK_COSTS[slot.unlockedSlots]!;
  if (currencies.subnodes < cost) return "insufficient";
  currencies.subnodes -= cost;
  slot.unlockedSlots += 1;
  return "ok";
}

export function levelUpSubroutine(
  slot: WardenSlotState,
  currencies: { subnodes: number },
  id: SubroutineId,
): "ok" | "max" | "insufficient" | "not-owned" {
  if (!slot.owned[id]) return "not-owned";
  const cur = slot.levels[id];
  if (cur >= SUBROUTINE_MAX_LEVEL) return "max";
  const cost = SUBROUTINE_LEVEL_COST_BASE * Math.pow(2, cur);
  if (currencies.subnodes < cost) return "insufficient";
  currencies.subnodes -= cost;
  slot.levels[id] = cur + 1;
  return "ok";
}

export function equipSubroutine(
  slot: WardenSlotState,
  slotIx: number,
  id: SubroutineId | null,
): void {
  if (slotIx < 0 || slotIx >= slot.unlockedSlots) return;
  if (id != null && !slot.owned[id]) return;
  if (id != null) {
    for (let i = 0; i < slot.equipped.length; i++) {
      if (i !== slotIx && slot.equipped[i] === id) slot.equipped[i] = null;
    }
  }
  slot.equipped[slotIx] = id;
}

export function grantSubroutine(slot: WardenSlotState, id: SubroutineId): void {
  slot.owned[id] = true;
  if (slot.levels[id] === 0) slot.levels[id] = 1;
}
