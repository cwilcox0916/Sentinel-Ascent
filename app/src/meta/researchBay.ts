/**
 * Research Bay — timed research projects with spec-accurate durations.
 *
 * Specs:
 *   - docs/my_game/04-progression-systems.md §5 (Research Bay)
 *   - docs/my_game/08-auto-procurement-spec.md §4 (AP tier cost model)
 *
 * Persistence: ResearchBayState lives on the SaveSlot (not the run snapshot) —
 * research progresses in real wall-clock time even while the game is closed.
 *
 * Time is stored as epoch ms on the server (i.e. browser clock). `completesAt`
 * is populated at queue time from the current clock + effective duration.
 * Project Acceleration + Heirloom multipliers shorten the effective duration.
 */

import type { AutoProcurementTier } from "../sim/autoProcurement.ts";

export type ProjectLine = "auto" | "acceleration" | "overclock";

export type ProjectId =
  | "autoProcurement_T1"
  | "autoProcurement_T2"
  | "autoProcurement_T3"
  | "autoProcurement_T4"
  | "projectAcceleration"
  | "overclock";

export type ResearchProjectDef = {
  id: ProjectId;
  line: ProjectLine;
  displayName: string;
  description: string;
  /** Alloy cost. Paid at queue time. */
  alloyCost: number;
  /** Catalyst cost. Paid at queue time. 0 for early projects. */
  catalystCost: number;
  /** Base real-time duration in ms. Project Acceleration divides this. */
  baseDurationMs: number;
  /** Stratum gate — Hangar denies queueing if the player hasn't reached it. */
  stratumGate: number;
  /** Companion Cycle gate — used purely for HUD display ("Stratum 4 · Cycle 50"). */
  cycleGate: number;
  /** Optional Tier this project unlocks, when researched. */
  unlocksTier?: AutoProcurementTier;
};

/** Spec-accurate durations, ported verbatim from docs/my_game/08-auto-procurement-spec.md §4. */
const THIRTY_MIN = 30 * 60 * 1000;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;

export const PROJECTS: ResearchProjectDef[] = [
  // Auto-Procurement tier ladder ----------------------------------------------
  {
    id: "autoProcurement_T1",
    line: "auto",
    displayName: "Procurement I — Single Channel",
    description:
      "Auto-buy enabled for one Forge category. Cheapest available stat in that category is purchased when Scrip allows.",
    alloyCost: 25_000,
    catalystCost: 0,
    baseDurationMs: THIRTY_MIN,
    stratumGate: 2,
    cycleGate: 100,
    unlocksTier: 1,
  },
  {
    id: "autoProcurement_T2",
    line: "auto",
    displayName: "Procurement II — Multi-Channel",
    description:
      "Auto-buy across all three categories simultaneously. Per-category on/off toggle. Per-category Scrip reserve floor.",
    alloyCost: 250_000,
    catalystCost: 0,
    baseDurationMs: FOUR_HOURS,
    stratumGate: 4,
    cycleGate: 50,
    unlocksTier: 2,
  },
  {
    id: "autoProcurement_T3",
    line: "auto",
    displayName: "Procurement III — Targeted",
    description:
      "Per-individual-stat toggles. Priority weight (1–10) per stat. Round-robin fairness within priority ties.",
    alloyCost: 5_000_000,
    catalystCost: 50,
    baseDurationMs: ONE_DAY,
    stratumGate: 7,
    cycleGate: 200,
    unlocksTier: 3,
  },
  {
    id: "autoProcurement_T4",
    line: "auto",
    displayName: "Procurement IV — Adaptive",
    description:
      "Conditional rules engine. Up to 5 active rules that override the targeted configuration when their conditions match.",
    alloyCost: 100_000_000,
    catalystCost: 500,
    baseDurationMs: SEVEN_DAYS,
    stratumGate: 12,
    cycleGate: 100,
    unlocksTier: 4,
  },

  // Project Acceleration line -------------------------------------------------
  {
    id: "projectAcceleration",
    line: "acceleration",
    displayName: "Project Acceleration",
    description:
      "Permanent research-speed multiplier. Stacks multiplicatively with Heirloom lab-speed bonuses (Phase 11).",
    alloyCost: 150_000,
    catalystCost: 0,
    baseDurationMs: FOUR_HOURS,
    stratumGate: 1,
    cycleGate: 150,
  },

  // Overclock (flat research-speed research, re-researchable) ----------------
  {
    id: "overclock",
    line: "overclock",
    displayName: "Overclock",
    description:
      "Flat +5% research speed per level. 30 total levels. Tapers per level so late investment stays meaningful.",
    alloyCost: 60_000,
    catalystCost: 0,
    baseDurationMs: THIRTY_MIN,
    stratumGate: 1,
    cycleGate: 150,
  },
];

const BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<ProjectId, ResearchProjectDef>;

export function getProject(id: ProjectId): ResearchProjectDef {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown project: ${id}`);
  return def;
}

/* ---------------- Runtime state ---------------- */

export type ResearchJob = {
  id: string; // project id + sequence, e.g. "autoProcurement_T1:0"
  projectId: ProjectId;
  startedAt: number;
  completesAt: number;
  /** Pending jobs (queued after an in-flight job) have `startedAt = completesAt = 0`. */
  queued: boolean;
};

export type ResearchSlot = {
  index: number; // 0..maxSlots-1
  job: ResearchJob | null;
  /** Optional next-job — auto-starts when `job` completes, if player can still afford. */
  queuedNext: ResearchJob | null;
};

export type ResearchBayState = {
  /** Levels/counts per project. 1 for "owned/researched" (AP tiers), 0..∞ for leveled lines. */
  levels: Partial<Record<ProjectId, number>>;
  /** Research slot array. Phase 6 ships 3 slots; Phase 4+ buys extra slots with Prisms. */
  slots: ResearchSlot[];
  /** Completion events consumed by the UI to trigger the rail glow + toasts. */
  completions: Array<{ projectId: ProjectId; completedAt: number }>;
};

export const INITIAL_RESEARCH_SLOTS = 3;

export function createResearchBayState(): ResearchBayState {
  return {
    levels: {},
    slots: [
      { index: 0, job: null, queuedNext: null },
      { index: 1, job: null, queuedNext: null },
      { index: 2, job: null, queuedNext: null },
    ],
    completions: [],
  };
}

/** True if the project is already fully researched (AP tiers are one-shot). */
export function isProjectOwned(state: ResearchBayState, id: ProjectId): boolean {
  const def = getProject(id);
  const level = state.levels[id] ?? 0;
  if (def.line === "auto") return level >= 1;
  // Leveled projects are never "fully owned" in Phase 6 — player can always queue another level.
  return false;
}

/** True if the project is currently in-flight in any slot. */
export function isProjectInFlight(state: ResearchBayState, id: ProjectId): boolean {
  for (const slot of state.slots) {
    if (slot.job && slot.job.projectId === id && !slot.job.queued) return true;
    if (slot.queuedNext && slot.queuedNext.projectId === id) return true;
  }
  return false;
}

/** Returns the speed multiplier applied by Project Acceleration. 1.0 = baseline. */
export function effectiveSpeedMultiplier(
  state: ResearchBayState,
  heirloomMult = 1,
): number {
  const paLevel = state.levels["projectAcceleration"] ?? 0;
  const ocLevel = state.levels["overclock"] ?? 0;
  // Matches docs/my_game/04-progression-systems.md §5 — Project Acceleration is a
  // multiplicative lab-speed research. Heirlooms stack multiplicatively on top.
  const pa = 1 + paLevel * 0.02;
  const oc = 1 + ocLevel * 0.05;
  return Math.min(10, pa * oc * heirloomMult);
}

export function effectiveDurationMs(
  state: ResearchBayState,
  def: ResearchProjectDef,
  heirloomMult = 1,
): number {
  return Math.max(1000, Math.floor(def.baseDurationMs / effectiveSpeedMultiplier(state, heirloomMult)));
}

export type QueueOutcome =
  | { ok: true; slot: ResearchSlot }
  | { ok: false; reason: "owned" | "in-flight" | "no-slot" | "unaffordable" | "stratum-locked" };

/**
 * Queue a project into the first free slot. If all slots are busy, attach it to
 * the first slot whose in-flight project matches the "queued after" predicate.
 * Phase 6 uses the simplest policy: queue into first free slot, else fail with
 * `no-slot` so the UI can route to a queue-next action.
 */
export function queueProject(
  state: ResearchBayState,
  currencies: { alloy: number; catalyst: number },
  stratum: number,
  id: ProjectId,
  now: number,
  heirloomMult = 1,
): QueueOutcome & { alloySpent?: number; catalystSpent?: number } {
  const def = getProject(id);
  if (isProjectOwned(state, id)) return { ok: false, reason: "owned" };
  if (isProjectInFlight(state, id)) return { ok: false, reason: "in-flight" };
  if (stratum < def.stratumGate) return { ok: false, reason: "stratum-locked" };
  if (currencies.alloy < def.alloyCost || currencies.catalyst < def.catalystCost) {
    return { ok: false, reason: "unaffordable" };
  }

  const slot = state.slots.find((s) => s.job === null);
  if (!slot) return { ok: false, reason: "no-slot" };

  const duration = effectiveDurationMs(state, def, heirloomMult);
  slot.job = {
    id: `${id}:${now}`,
    projectId: id,
    startedAt: now,
    completesAt: now + duration,
    queued: false,
  };
  return {
    ok: true,
    slot,
    alloySpent: def.alloyCost,
    catalystSpent: def.catalystCost,
  };
}

/**
 * Queue a "next" job that auto-starts when another in-flight project completes.
 * Phase 6 supports exactly one queuedNext per slot. Cost is deducted when the
 * queuedNext actually starts — the spec allows cancelling the queue without penalty.
 */
export function queueAfter(
  state: ResearchBayState,
  targetSlotIndex: number,
  id: ProjectId,
  now: number,
): QueueOutcome {
  const slot = state.slots[targetSlotIndex];
  if (!slot) return { ok: false, reason: "no-slot" };
  if (!slot.job) return { ok: false, reason: "no-slot" }; // nothing to queue after
  if (slot.queuedNext) return { ok: false, reason: "in-flight" };
  if (isProjectOwned(state, id)) return { ok: false, reason: "owned" };
  if (isProjectInFlight(state, id)) return { ok: false, reason: "in-flight" };

  slot.queuedNext = {
    id: `${id}:queued:${now}`,
    projectId: id,
    startedAt: 0,
    completesAt: 0,
    queued: true,
  };
  return { ok: true, slot };
}

export function cancelQueued(state: ResearchBayState, slotIndex: number): void {
  const slot = state.slots[slotIndex];
  if (slot) slot.queuedNext = null;
}

/**
 * Progress all slots forward to the given wall-clock time. Fires completions
 * and auto-starts queuedNext jobs when the player can still afford them.
 *
 * Returns the projectIds that completed this tick (so the UI can celebrate).
 */
export function progressResearch(
  state: ResearchBayState,
  currencies: { alloy: number; catalyst: number },
  now: number,
  heirloomMult = 1,
): { completed: ProjectId[]; alloySpent: number; catalystSpent: number } {
  const completed: ProjectId[] = [];
  let alloySpent = 0;
  let catalystSpent = 0;

  for (const slot of state.slots) {
    const job = slot.job;
    if (!job || job.queued) continue;
    if (now < job.completesAt) continue;

    // Complete!
    state.levels[job.projectId] = (state.levels[job.projectId] ?? 0) + 1;
    completed.push(job.projectId);
    state.completions.push({ projectId: job.projectId, completedAt: now });
    slot.job = null;

    // Promote queuedNext if affordable. Important: clear queuedNext *before*
    // the isProjectInFlight check so we don't see our own stub as already-queued.
    if (slot.queuedNext) {
      const nextProjectId = slot.queuedNext.projectId;
      slot.queuedNext = null;
      const nextDef = getProject(nextProjectId);
      const canAfford =
        currencies.alloy - alloySpent >= nextDef.alloyCost &&
        currencies.catalyst - catalystSpent >= nextDef.catalystCost;
      if (canAfford && !isProjectOwned(state, nextDef.id) && !isProjectInFlight(state, nextDef.id)) {
        const duration = effectiveDurationMs(state, nextDef, heirloomMult);
        slot.job = {
          id: `${nextDef.id}:${now}`,
          projectId: nextDef.id,
          startedAt: now,
          completesAt: now + duration,
          queued: false,
        };
        alloySpent += nextDef.alloyCost;
        catalystSpent += nextDef.catalystCost;
      }
    }
  }

  return { completed, alloySpent, catalystSpent };
}

/** Drain completion events — called by UI after displaying the glow. */
export function drainCompletions(state: ResearchBayState): ProjectId[] {
  const drained = state.completions.map((c) => c.projectId);
  state.completions = [];
  return drained;
}
