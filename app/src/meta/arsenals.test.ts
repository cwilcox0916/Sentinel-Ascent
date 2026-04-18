import { describe, it, expect } from "vitest";
import {
  arsenalLevelUpCost,
  buyArsenal,
  createArsenalSlotState,
  effectiveCooldownSec,
  getArsenal,
  listArsenals,
  toggleArsenalEquipped,
} from "./arsenals.ts";

describe("Arsenals", () => {
  it("ships the 3 starter Arsenals", () => {
    expect(listArsenals().length).toBe(3);
    expect(listArsenals().map((a) => a.id).sort()).toEqual([
      "arc-cascade",
      "seeker-salvo",
      "stasis-field",
    ]);
  });

  it("buyArsenal auto-equips on first acquire", () => {
    const s = createArsenalSlotState();
    const cur = { cores: 100 };
    expect(buyArsenal(s, cur, "seeker-salvo")).toBe("bought");
    expect(s.levels["seeker-salvo"]).toBe(1);
    expect(s.equipped["seeker-salvo"]).toBe(true);
  });

  it("buyArsenal refuses when Cores insufficient", () => {
    const s = createArsenalSlotState();
    const cur = { cores: 0 };
    expect(buyArsenal(s, cur, "seeker-salvo")).toBe("insufficient");
  });

  it("toggleArsenalEquipped requires the Arsenal be owned", () => {
    const s = createArsenalSlotState();
    toggleArsenalEquipped(s, "arc-cascade", true);
    expect(s.equipped["arc-cascade"]).toBe(false);
    s.levels["arc-cascade"] = 1;
    toggleArsenalEquipped(s, "arc-cascade", true);
    expect(s.equipped["arc-cascade"]).toBe(true);
  });

  it("effectiveCooldownSec scales by 0.9^(level-1)", () => {
    const def = getArsenal("seeker-salvo");
    expect(effectiveCooldownSec(def, 1)).toBeCloseTo(def.baseCooldownSec);
    expect(effectiveCooldownSec(def, 2)).toBeCloseTo(def.baseCooldownSec * 0.9);
    expect(effectiveCooldownSec(def, 5)).toBeCloseTo(def.baseCooldownSec * 0.9 ** 4);
  });

  it("arsenalLevelUpCost grows geometrically", () => {
    expect(arsenalLevelUpCost(0)).toBe(5);
    expect(arsenalLevelUpCost(1)).toBeGreaterThan(arsenalLevelUpCost(0));
    expect(arsenalLevelUpCost(5)).toBeGreaterThan(arsenalLevelUpCost(4));
  });
});
