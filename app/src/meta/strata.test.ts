import { describe, it, expect } from "vitest";
import { STRATA, getStratum, isStratumUnlocked, maxUnlockedStratum } from "./strata.ts";

describe("Strata catalogue", () => {
  it("ships 18 Strata", () => {
    expect(STRATA.length).toBe(18);
  });

  it("ids are contiguous 1..18", () => {
    for (let i = 0; i < STRATA.length; i++) {
      expect(STRATA[i]!.id).toBe(i + 1);
    }
  });

  it("base scale monotonically increases", () => {
    for (let i = 1; i < STRATA.length; i++) {
      expect(STRATA[i]!.baseScale).toBeGreaterThan(STRATA[i - 1]!.baseScale);
    }
  });

  it("Stratum 1 is always unlocked", () => {
    expect(isStratumUnlocked(1, 0)).toBe(true);
  });

  it("Stratum 2 is gated on cycle 100", () => {
    expect(isStratumUnlocked(2, 99)).toBe(false);
    expect(isStratumUnlocked(2, 100)).toBe(true);
  });

  it("maxUnlockedStratum climbs with highestCycle", () => {
    expect(maxUnlockedStratum(0)).toBe(1);
    expect(maxUnlockedStratum(99)).toBe(1);
    expect(maxUnlockedStratum(200)).toBe(3);
    expect(maxUnlockedStratum(10_000)).toBe(18);
  });

  it("throws for unknown Stratum id", () => {
    expect(() => getStratum(99)).toThrow();
  });
});
