import { describe, it, expect } from "vitest";
import {
  cancelQueued,
  createResearchBayState,
  effectiveDurationMs,
  effectiveSpeedMultiplier,
  getProject,
  isProjectInFlight,
  isProjectOwned,
  progressResearch,
  queueAfter,
  queueProject,
} from "./researchBay.ts";

describe("Research Bay — queueProject", () => {
  it("queues into first free slot and deducts cost", () => {
    const state = createResearchBayState();
    const currencies = { alloy: 100_000, catalyst: 0 };
    const result = queueProject(state, currencies, /* stratum */ 20, "autoProcurement_T1", 1_000_000);
    expect(result.ok).toBe(true);
    expect(state.slots[0]!.job?.projectId).toBe("autoProcurement_T1");
    expect(result.alloySpent).toBe(getProject("autoProcurement_T1").alloyCost);
  });

  it("rejects when insufficient Alloy", () => {
    const state = createResearchBayState();
    const result = queueProject(state, { alloy: 100, catalyst: 0 }, 20, "autoProcurement_T1", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unaffordable");
  });

  it("rejects when stratum-gated", () => {
    const state = createResearchBayState();
    const result = queueProject(state, { alloy: 999_999_999, catalyst: 999 }, /* stratum */ 1, "autoProcurement_T4", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("stratum-locked");
  });

  it("rejects when the project is already owned", () => {
    const state = createResearchBayState();
    state.levels["autoProcurement_T1"] = 1;
    const result = queueProject(state, { alloy: 999_999, catalyst: 0 }, 20, "autoProcurement_T1", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("owned");
  });

  it("rejects when the project is already in-flight", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999, catalyst: 0 }, 20, "autoProcurement_T1", 0);
    const result = queueProject(state, { alloy: 999_999, catalyst: 0 }, 20, "autoProcurement_T1", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("in-flight");
  });

  it("rejects when all slots are occupied", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999, catalyst: 999 }, 20, "autoProcurement_T1", 0);
    queueProject(state, { alloy: 999_999_999, catalyst: 999 }, 20, "autoProcurement_T2", 0);
    queueProject(state, { alloy: 999_999_999, catalyst: 999 }, 20, "autoProcurement_T3", 0);
    const result = queueProject(state, { alloy: 999_999_999, catalyst: 999 }, 20, "projectAcceleration", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-slot");
  });
});

describe("Research Bay — progressResearch", () => {
  it("completes a project when its time arrives and grants the level", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999, catalyst: 0 }, 20, "autoProcurement_T1", 1000);
    const job = state.slots[0]!.job!;
    const result = progressResearch(state, { alloy: 0, catalyst: 0 }, job.completesAt + 1);
    expect(result.completed).toContain("autoProcurement_T1");
    expect(isProjectOwned(state, "autoProcurement_T1")).toBe(true);
    expect(state.slots[0]!.job).toBeNull();
  });

  it("does not complete before the job's scheduled time", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999, catalyst: 0 }, 20, "autoProcurement_T1", 1000);
    const job = state.slots[0]!.job!;
    const result = progressResearch(state, { alloy: 0, catalyst: 0 }, job.completesAt - 1);
    expect(result.completed).toEqual([]);
    expect(isProjectOwned(state, "autoProcurement_T1")).toBe(false);
  });
});

describe("Research Bay — queueAfter", () => {
  it("queues a follow-up job that auto-starts when the in-flight one completes", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999_999, catalyst: 999 }, 20, "autoProcurement_T1", 0);
    const result = queueAfter(state, 0, "autoProcurement_T2", 1);
    expect(result.ok).toBe(true);
    expect(state.slots[0]!.queuedNext?.projectId).toBe("autoProcurement_T2");

    const job = state.slots[0]!.job!;
    const t2Def = getProject("autoProcurement_T2");
    const prog = progressResearch(state, { alloy: t2Def.alloyCost, catalyst: t2Def.catalystCost }, job.completesAt + 1);
    expect(prog.completed).toContain("autoProcurement_T1");
    expect(isProjectInFlight(state, "autoProcurement_T2")).toBe(true);
    expect(state.slots[0]!.queuedNext).toBeNull();
  });

  it("skips queuedNext promotion if player cannot afford it at completion time", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999_999, catalyst: 999 }, 20, "autoProcurement_T1", 0);
    queueAfter(state, 0, "autoProcurement_T2", 1);
    const job = state.slots[0]!.job!;
    const prog = progressResearch(state, { alloy: 0, catalyst: 0 }, job.completesAt + 1);
    expect(prog.completed).toContain("autoProcurement_T1");
    expect(isProjectInFlight(state, "autoProcurement_T2")).toBe(false);
    expect(state.slots[0]!.queuedNext).toBeNull(); // queue cleared even when skipped
  });

  it("cancelQueued clears a pending queuedNext without penalty", () => {
    const state = createResearchBayState();
    queueProject(state, { alloy: 999_999_999, catalyst: 999 }, 20, "autoProcurement_T1", 0);
    queueAfter(state, 0, "autoProcurement_T2", 1);
    cancelQueued(state, 0);
    expect(state.slots[0]!.queuedNext).toBeNull();
  });
});

describe("Research Bay — Project Acceleration", () => {
  it("shortens effective durations", () => {
    const state = createResearchBayState();
    const def = getProject("autoProcurement_T1");
    const base = effectiveDurationMs(state, def);
    state.levels["projectAcceleration"] = 10; // +20%
    const faster = effectiveDurationMs(state, def);
    expect(faster).toBeLessThan(base);
    expect(effectiveSpeedMultiplier(state)).toBeCloseTo(1.2, 2);
  });

  it("stacks multiplicatively with Overclock", () => {
    const state = createResearchBayState();
    state.levels["projectAcceleration"] = 10; // ×1.20
    state.levels["overclock"] = 4; // ×1.20
    expect(effectiveSpeedMultiplier(state)).toBeCloseTo(1.2 * 1.2, 2);
  });
});
