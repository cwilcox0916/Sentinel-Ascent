import { describe, it, expect } from "vitest";
import { createRunState } from "./runState.ts";
import { simulateTick } from "./tick.ts";

describe("Perf smoke — spatial hash at large enemy counts", () => {
  it("survives 600 ticks at Cycle 500 in under a few seconds", () => {
    const run = createRunState(1n, { stratum: 1, stratumScale: 1 });
    // Jump to Cycle 500 so the spawner pours enemies in.
    run.cycle = 500;
    run.cycleEnemyBudget = 600;
    run.cycleProgressMs = 0;
    run.cycleSpawnAccumulator = 0;
    const start = performance.now();
    for (let i = 0; i < 600; i++) simulateTick(run);
    const ms = performance.now() - start;
    // Generous bound for CI variance — baseline on a dev laptop is ~150ms.
    expect(ms).toBeLessThan(3000);
  });
});
