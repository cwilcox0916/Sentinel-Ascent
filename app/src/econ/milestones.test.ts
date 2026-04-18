import { describe, it, expect } from "vitest";
import { checkMilestones, createMilestoneRunState, milestoneRewardFor } from "./milestones.ts";
import { createEmptySlot } from "../save/schema.ts";
import { createRunState } from "../sim/runState.ts";

describe("Stratum Milestones", () => {
  it("grants nothing before cycle 50", () => {
    const slot = createEmptySlot(1, "test");
    const run = createRunState(1n, { stratum: 1, stratumScale: 1 });
    const ms = createMilestoneRunState();
    run.cycle = 49;
    expect(checkMilestones(slot, run, ms).length).toBe(0);
  });

  it("grants at 50, 100, 150 cycles", () => {
    const slot = createEmptySlot(1, "test");
    const run = createRunState(1n, { stratum: 1, stratumScale: 1 });
    const ms = createMilestoneRunState();
    run.cycle = 50;
    expect(checkMilestones(slot, run, ms).length).toBe(1);
    run.cycle = 100;
    expect(checkMilestones(slot, run, ms).length).toBe(1);
    run.cycle = 149;
    expect(checkMilestones(slot, run, ms).length).toBe(0);
    run.cycle = 150;
    expect(checkMilestones(slot, run, ms).length).toBe(1);
  });

  it("grants multiple milestones if we skip past them", () => {
    const slot = createEmptySlot(1, "test");
    const run = createRunState(1n, { stratum: 3, stratumScale: 1 });
    const ms = createMilestoneRunState();
    run.cycle = 250;
    const grants = checkMilestones(slot, run, ms);
    // 50, 100, 150, 200, 250 = 5
    expect(grants.length).toBe(5);
  });

  it("Stratum 3+ grants Cores; Stratum 10+ grants Catalyst", () => {
    const r3 = milestoneRewardFor(3, 50);
    expect(r3.cores).toBe(2);
    expect(r3.catalyst).toBe(0);
    const r10 = milestoneRewardFor(10, 50);
    expect(r10.catalyst).toBe(1);
  });

  it("actually mutates slot currencies", () => {
    const slot = createEmptySlot(1, "test");
    const run = createRunState(1n, { stratum: 1, stratumScale: 1 });
    const ms = createMilestoneRunState();
    run.cycle = 50;
    const prismsBefore = slot.currencies.prisms;
    checkMilestones(slot, run, ms);
    expect(slot.currencies.prisms).toBeGreaterThan(prismsBefore);
  });
});
