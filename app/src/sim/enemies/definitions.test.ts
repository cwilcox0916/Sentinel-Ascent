import { describe, it, expect } from "vitest";
import {
  BEHEMOTH_INTERVAL,
  cyclesToNextBehemoth,
  getEnemyDefinition,
  isBehemothCycle,
  normalCompositionForCycle,
} from "./definitions.ts";

describe("Enemy definitions catalogue", () => {
  it("exposes all Phase 5 archetypes", () => {
    for (const a of ["drone", "skimmer", "hulk", "lancer", "behemoth"] as const) {
      const def = getEnemyDefinition(a);
      expect(def.archetype).toBe(a);
      expect(def.baseHp).toBeGreaterThan(0);
      expect(def.radius).toBeGreaterThan(0);
    }
  });

  it("throws for enemies that do not yet exist", () => {
    expect(() => getEnemyDefinition("aegis")).toThrow();
  });

  it("Skimmer is faster and frailer than Drone", () => {
    const drone = getEnemyDefinition("drone");
    const skimmer = getEnemyDefinition("skimmer");
    expect(skimmer.baseSpeed).toBeGreaterThan(drone.baseSpeed);
    expect(skimmer.baseHp).toBeLessThan(drone.baseHp);
  });

  it("Hulk is slower and tankier than Drone", () => {
    const drone = getEnemyDefinition("drone");
    const hulk = getEnemyDefinition("hulk");
    expect(hulk.baseSpeed).toBeLessThan(drone.baseSpeed);
    expect(hulk.baseHp).toBeGreaterThan(drone.baseHp);
  });

  it("Lancer has a ranged profile", () => {
    const lancer = getEnemyDefinition("lancer");
    expect(lancer.ranged).toBeDefined();
    expect(lancer.ranged!.stoppingDistance).toBeGreaterThan(0);
    expect(lancer.ranged!.projectileDamage).toBeGreaterThan(0);
  });

  it("Behemoth HP is many multiples of Drone HP", () => {
    const drone = getEnemyDefinition("drone");
    const beh = getEnemyDefinition("behemoth");
    expect(beh.baseHp / drone.baseHp).toBeGreaterThanOrEqual(20);
  });
});

describe("Cycle composition ramp", () => {
  it("starts as Drones only in Cycles 1–2", () => {
    expect(normalCompositionForCycle(1).map((d) => d.archetype)).toEqual(["drone"]);
    expect(normalCompositionForCycle(2).map((d) => d.archetype)).toEqual(["drone"]);
  });

  it("introduces Skimmers from Cycle 3", () => {
    expect(normalCompositionForCycle(3).map((d) => d.archetype)).toContain("skimmer");
  });

  it("adds Hulks from Cycle 5", () => {
    expect(normalCompositionForCycle(5).map((d) => d.archetype)).toContain("hulk");
  });

  it("adds Lancers from Cycle 7", () => {
    expect(normalCompositionForCycle(7).map((d) => d.archetype)).toContain("lancer");
  });
});

describe("Behemoth schedule", () => {
  it("fires every BEHEMOTH_INTERVAL cycles", () => {
    expect(isBehemothCycle(BEHEMOTH_INTERVAL)).toBe(true);
    expect(isBehemothCycle(BEHEMOTH_INTERVAL * 2)).toBe(true);
    expect(isBehemothCycle(BEHEMOTH_INTERVAL + 1)).toBe(false);
  });

  it("reports cycles remaining until next Behemoth", () => {
    expect(cyclesToNextBehemoth(1)).toBe(BEHEMOTH_INTERVAL - 1);
    expect(cyclesToNextBehemoth(BEHEMOTH_INTERVAL - 1)).toBe(1);
    expect(cyclesToNextBehemoth(BEHEMOTH_INTERVAL)).toBe(BEHEMOTH_INTERVAL);
  });
});
