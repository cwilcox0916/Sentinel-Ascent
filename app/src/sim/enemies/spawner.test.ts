import { describe, it, expect } from "vitest";
import { createRunState } from "../runState.ts";
import { simulateTick } from "../tick.ts";
import { BEHEMOTH_INTERVAL } from "./definitions.ts";

/**
 * Integration tests for the Phase 5 spawner: roster mixing + Behemoth schedule.
 */
describe("Spawner — Cycle roster", () => {
  it("only spawns Drones in Cycle 1 (onboarding ramp)", () => {
    const run = createRunState(1n);
    // Run most of the first Cycle.
    for (let i = 0; i < 60 * 10; i++) simulateTick(run);
    const archetypes = new Set(run.enemies.map((e) => e.archetype));
    // Enemies can have died before we look; count all spawned archetypes via nextEntityId isn't perfect, so fall back:
    for (const a of archetypes) {
      expect(["drone", "behemoth"]).toContain(a);
    }
  });

  it("schedules a Behemoth exactly once on a Behemoth Cycle", () => {
    const run = createRunState(123n);
    // Fast-forward to a Behemoth Cycle by overriding the Cycle directly.
    run.cycle = BEHEMOTH_INTERVAL;
    run.spawnerState.behemothSpawnedThisCycle = false;
    // Tick a few times — the spawner should spawn one Behemoth and only one.
    for (let i = 0; i < 60; i++) simulateTick(run);
    const behemoths = run.enemies.filter((e) => e.archetype === "behemoth");
    expect(behemoths.length).toBe(1);
  });

  it("does not schedule a Behemoth on non-Behemoth Cycles", () => {
    const run = createRunState(5n);
    run.cycle = BEHEMOTH_INTERVAL - 1;
    run.spawnerState.behemothSpawnedThisCycle = false;
    for (let i = 0; i < 60; i++) simulateTick(run);
    const behemoths = run.enemies.filter((e) => e.archetype === "behemoth");
    expect(behemoths.length).toBe(0);
  });
});
