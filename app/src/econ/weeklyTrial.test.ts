import { describe, it, expect } from "vitest";
import {
  cipherKeysForCycle,
  createWeeklyTrialState,
  recordTrialRun,
  weeklyTrialSeed,
} from "./weeklyTrial.ts";
import { EMPTY_CURRENCIES } from "../save/schema.ts";

describe("Weekly Trial", () => {
  it("same week produces same seed", () => {
    const a = weeklyTrialSeed(202518);
    const b = weeklyTrialSeed(202518);
    expect(a).toBe(b);
  });

  it("different weeks produce different seeds", () => {
    const a = weeklyTrialSeed(202518);
    const b = weeklyTrialSeed(202519);
    expect(a).not.toBe(b);
  });

  it("cipherKeysForCycle bracket table", () => {
    expect(cipherKeysForCycle(10)).toBe(0);
    expect(cipherKeysForCycle(25)).toBe(1);
    expect(cipherKeysForCycle(50)).toBe(2);
    expect(cipherKeysForCycle(100)).toBe(3);
    expect(cipherKeysForCycle(200)).toBe(5);
  });

  it("records best cycle and awards delta Cipher", () => {
    const s = createWeeklyTrialState();
    const cur = { ...EMPTY_CURRENCIES };
    const week = 202518;
    expect(recordTrialRun(s, cur, 30, week).cipherDelta).toBe(1);
    expect(cur.cipherKeys).toBe(1);
    expect(recordTrialRun(s, cur, 60, week).cipherDelta).toBe(1); // 1 → 2 bracket
    expect(cur.cipherKeys).toBe(2);
    expect(recordTrialRun(s, cur, 40, week).cipherDelta).toBe(0); // below best
    expect(cur.cipherKeys).toBe(2);
  });

  it("attempts counter always increments", () => {
    const s = createWeeklyTrialState();
    const cur = { ...EMPTY_CURRENCIES };
    recordTrialRun(s, cur, 10, 202518);
    recordTrialRun(s, cur, 10, 202518);
    expect(s.records[202518]!.attempts).toBe(2);
  });
});
