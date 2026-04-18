import { describe, it, expect } from "vitest";
import { createRunState } from "./runState.ts";
import { simulateTick } from "./tick.ts";

/**
 * The deterministic-replay property: same seed + zero player input → identical
 * RunState after N ticks. This is the contract that makes Weekly Trial replays
 * and mid-run save snapshots possible.
 */
describe("simulateTick determinism", () => {
  it("produces identical state after 600 ticks for the same seed", () => {
    const a = createRunState(12345n);
    const b = createRunState(12345n);
    for (let i = 0; i < 600; i++) {
      simulateTick(a);
      simulateTick(b);
    }
    expect(a.tickNumber).toBe(b.tickNumber);
    expect(a.cycle).toBe(b.cycle);
    expect(a.scrip).toBe(b.scrip);
    expect(a.alloy).toBe(b.alloy);
    expect(a.sentinel.stats.health).toBe(b.sentinel.stats.health);
    expect(a.enemies.length).toBe(b.enemies.length);
    expect(a.projectiles.length).toBe(b.projectiles.length);

    // Spot-check enemy positions match exactly
    for (let i = 0; i < a.enemies.length; i++) {
      const ea = a.enemies[i]!;
      const eb = b.enemies[i]!;
      expect(ea.pos.x).toBe(eb.pos.x);
      expect(ea.pos.y).toBe(eb.pos.y);
      expect(ea.hp).toBe(eb.hp);
    }
  });

  it("different seeds produce different enemy spawn positions", () => {
    const a = createRunState(1n);
    const b = createRunState(2n);
    for (let i = 0; i < 120; i++) {
      simulateTick(a);
      simulateTick(b);
    }
    // It's astronomically unlikely the two streams happen to match exactly.
    const aFirst = a.enemies[0];
    const bFirst = b.enemies[0];
    if (aFirst && bFirst) {
      expect([aFirst.pos.x, aFirst.pos.y]).not.toEqual([bFirst.pos.x, bFirst.pos.y]);
    } else {
      expect(a.enemies.length === b.enemies.length).toBe(false);
    }
  });

  it("Sentinel earns Alloy as Drones die", () => {
    const run = createRunState(7n);
    // Run long enough for projectiles to kill at least one Drone.
    for (let i = 0; i < 600; i++) simulateTick(run);
    expect(run.alloy).toBeGreaterThan(0);
  });
});
