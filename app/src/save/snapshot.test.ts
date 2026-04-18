import { describe, it, expect } from "vitest";
import { createRunState } from "../sim/runState.ts";
import { simulateTick } from "../sim/tick.ts";
import { snapshotRun, restoreRun } from "./snapshot.ts";

/**
 * The snapshot determinism property: snapshot at tick N → restore → simulate
 * → identical to "did not snapshot, just simulated".
 *
 * This is the contract that makes mid-run save resume work and Weekly Trial
 * replays reproducible.
 */
describe("RunSnapshot round-trip", () => {
  it("preserves all live RunState fields through serialize/deserialize", () => {
    const run = createRunState(99n);
    for (let i = 0; i < 200; i++) simulateTick(run);

    const snap = snapshotRun(run);
    const restored = restoreRun(snap);

    expect(restored.tickNumber).toBe(run.tickNumber);
    expect(restored.cycle).toBe(run.cycle);
    expect(restored.scrip).toBe(run.scrip);
    expect(restored.alloy).toBe(run.alloy);
    expect(restored.enemies.length).toBe(run.enemies.length);
    expect(restored.projectiles.length).toBe(run.projectiles.length);
    expect(restored.sentinel.stats.health).toBe(run.sentinel.stats.health);
    expect(restored.sentinel.stats.damage).toBe(run.sentinel.stats.damage);
    expect(restored.forge.levels).toEqual(run.forge.levels);
    expect(restored.rng.s0).toBe(run.rng.s0);
    expect(restored.rng.s1).toBe(run.rng.s1);
    expect(restored.seed).toBe(run.seed);
  });

  it("resumed run progresses identically to a continuous run (mid-cycle)", () => {
    const baseline = createRunState(123n);
    const branchAt = 350; // some interior tick
    for (let i = 0; i < branchAt; i++) simulateTick(baseline);

    // Snapshot, then keep simulating the original.
    const snap = snapshotRun(baseline);
    for (let i = 0; i < 250; i++) simulateTick(baseline);

    // Restore from the snapshot, sim the same number of ticks.
    const resumed = restoreRun(snap);
    for (let i = 0; i < 250; i++) simulateTick(resumed);

    expect(resumed.tickNumber).toBe(baseline.tickNumber);
    expect(resumed.cycle).toBe(baseline.cycle);
    expect(resumed.scrip).toBe(baseline.scrip);
    expect(resumed.alloy).toBe(baseline.alloy);
    expect(resumed.enemies.length).toBe(baseline.enemies.length);
    expect(resumed.projectiles.length).toBe(baseline.projectiles.length);

    for (let i = 0; i < resumed.enemies.length; i++) {
      const a = resumed.enemies[i]!;
      const b = baseline.enemies[i]!;
      expect(a.pos.x).toBe(b.pos.x);
      expect(a.pos.y).toBe(b.pos.y);
      expect(a.hp).toBe(b.hp);
    }
  });

  it("snapshot is JSON-safe (BigInts serialized as strings)", () => {
    const run = createRunState(0xdeadbeefn);
    for (let i = 0; i < 50; i++) simulateTick(run);
    const snap = snapshotRun(run);
    const text = JSON.stringify(snap);
    expect(text.length).toBeGreaterThan(0);
    const parsed = JSON.parse(text);
    expect(typeof parsed.seed).toBe("string");
    expect(typeof parsed.rngState.s0).toBe("string");
    expect(typeof parsed.rngState.s1).toBe("string");
  });
});
