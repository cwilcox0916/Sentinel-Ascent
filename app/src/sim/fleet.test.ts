import { describe, it, expect } from "vitest";
import {
  fleetForCycle,
  FLEET_ONSET_CYCLE,
  FLEET_REPEAT_INTERVAL,
  isFleet,
  isFleetCycle,
} from "./enemies/definitions.ts";
import { createRunState } from "./runState.ts";
import { updateSpawner } from "./enemies/spawner.ts";

describe("Fleet scheduling", () => {
  it("no fleet before onset Cycle", () => {
    expect(isFleetCycle(100)).toBe(false);
    expect(isFleetCycle(FLEET_ONSET_CYCLE - 1)).toBe(false);
  });

  it("fleet triggers exactly on onset and every interval after", () => {
    expect(isFleetCycle(FLEET_ONSET_CYCLE)).toBe(true);
    expect(isFleetCycle(FLEET_ONSET_CYCLE + FLEET_REPEAT_INTERVAL)).toBe(true);
    expect(isFleetCycle(FLEET_ONSET_CYCLE + 1)).toBe(false);
  });

  it("fleet roster rotates D/O/R", () => {
    expect(fleetForCycle(FLEET_ONSET_CYCLE)).toBe("disruptor");
    expect(fleetForCycle(FLEET_ONSET_CYCLE + FLEET_REPEAT_INTERVAL)).toBe("overseer");
    expect(fleetForCycle(FLEET_ONSET_CYCLE + FLEET_REPEAT_INTERVAL * 2)).toBe("resonant");
    expect(fleetForCycle(FLEET_ONSET_CYCLE + FLEET_REPEAT_INTERVAL * 3)).toBe("disruptor");
  });

  it("isFleet helper identifies the 3 archetypes", () => {
    expect(isFleet("disruptor")).toBe(true);
    expect(isFleet("overseer")).toBe(true);
    expect(isFleet("resonant")).toBe(true);
    expect(isFleet("drone")).toBe(false);
    expect(isFleet("behemoth")).toBe(false);
  });

  it("spawner drops exactly one fleet enemy on a fleet Cycle", () => {
    const run = createRunState(1n);
    run.cycle = FLEET_ONSET_CYCLE;
    run.cycleProgressMs = 0;
    run.cycleEnemyBudget = 0;
    updateSpawner(run, 0.016);
    const fleetCount = run.enemies.filter((e) => isFleet(e.archetype)).length;
    expect(fleetCount).toBe(1);
    // Calling again should not double-spawn (flag gate).
    updateSpawner(run, 0.016);
    const fleetCount2 = run.enemies.filter((e) => isFleet(e.archetype)).length;
    expect(fleetCount2).toBe(1);
  });
});
