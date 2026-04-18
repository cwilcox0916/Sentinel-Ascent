import { describe, it, expect } from "vitest";
import {
  checkCycleAchievements,
  checkLoadoutAchievements,
  claimAchievement,
  listAchievements,
  recordAlloyEarned,
  recordBehemothKill,
} from "./achievements.ts";
import { createEmptySlot } from "../save/schema.ts";
import { createRunState } from "../sim/runState.ts";

describe("Achievement Vault", () => {
  it("ships 20 launch achievements", () => {
    expect(listAchievements().length).toBe(20);
  });

  it("cycle achievements unlock based on run.cycle + run.stats.kills", () => {
    const slot = createEmptySlot(1, "t");
    const run = createRunState(1n);
    run.cycle = 25;
    const ids = checkCycleAchievements(slot, run);
    expect(ids).toContain("cycle-25");
    expect(slot.achievements.unlocked["cycle-25"]).toBe(true);
  });

  it("claim grants Prisms and marks claimed", () => {
    const slot = createEmptySlot(1, "t");
    slot.achievements.unlocked["first-behemoth"] = true;
    const cur = { prisms: 0 };
    const r = claimAchievement(slot.achievements, cur, "first-behemoth");
    expect(r).toBe("claimed");
    expect(cur.prisms).toBe(20);
    // Double claim is rejected.
    expect(claimAchievement(slot.achievements, cur, "first-behemoth")).toBe("already-claimed");
  });

  it("recordAlloyEarned trips thresholds", () => {
    const slot = createEmptySlot(1, "t");
    recordAlloyEarned(slot, 500);
    expect(slot.achievements.unlocked["earn-1000-alloy"]).toBe(false);
    recordAlloyEarned(slot, 600);
    expect(slot.achievements.unlocked["earn-1000-alloy"]).toBe(true);
  });

  it("loadout achievements pick up equipped protocols", () => {
    const slot = createEmptySlot(1, "t");
    slot.protocols.levels["overclock"] = 1;
    slot.protocols.levels["rapid-fire"] = 1;
    slot.protocols.levels["long-barrel"] = 1;
    slot.protocols.equipped = ["overclock", "rapid-fire", "long-barrel"];
    const ids = checkLoadoutAchievements(slot);
    expect(ids).toContain("first-protocol");
    expect(ids).toContain("three-protocols-equipped");
  });

  it("recordBehemothKill unlocks first-behemoth once", () => {
    const slot = createEmptySlot(1, "t");
    expect(recordBehemothKill(slot)).toEqual(["first-behemoth"]);
    expect(recordBehemothKill(slot)).toEqual([]);
  });
});
