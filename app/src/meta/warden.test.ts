import { describe, it, expect } from "vitest";
import {
  createWardenSlotState,
  equipSubroutine,
  grantSubroutine,
  isWardenUnlockEligible,
  levelUpSubroutine,
  listSubroutines,
  SLOT_UNLOCK_COSTS,
  unlockNextSlot,
  unlockWarden,
} from "./warden.ts";

describe("Warden", () => {
  it("unlock requires 100 Subnodes", () => {
    const s = createWardenSlotState();
    const cur = { subnodes: 50 };
    expect(unlockWarden(s, cur)).toBe("insufficient");
    cur.subnodes = 100;
    expect(unlockWarden(s, cur)).toBe("ok");
    expect(s.unlocked).toBe(true);
    expect(s.unlockedSlots).toBe(1);
    expect(s.owned["strike"]).toBe(true); // starter
    expect(s.equipped[0]).toBe("strike");
  });

  it("unlock is idempotent", () => {
    const s = createWardenSlotState();
    const cur = { subnodes: 200 };
    unlockWarden(s, cur);
    const remaining = cur.subnodes;
    expect(unlockWarden(s, cur)).toBe("ok");
    expect(cur.subnodes).toBe(remaining);
  });

  it("slot unlock costs escalate", () => {
    const s = createWardenSlotState();
    const cur = { subnodes: 1000 };
    unlockWarden(s, cur); // -100
    expect(unlockNextSlot(s, cur)).toBe("ok"); // -200
    expect(unlockNextSlot(s, cur)).toBe("ok"); // -300
    expect(unlockNextSlot(s, cur)).toBe("max");
    expect(s.unlockedSlots).toBe(3);
    expect(cur.subnodes).toBe(1000 - SLOT_UNLOCK_COSTS.reduce((a, b) => a + b, 0));
  });

  it("level-up is gated by owned flag", () => {
    const s = createWardenSlotState();
    const cur = { subnodes: 500 };
    expect(levelUpSubroutine(s, cur, "bounty")).toBe("not-owned");
    grantSubroutine(s, "bounty");
    expect(levelUpSubroutine(s, cur, "bounty")).toBe("ok");
    expect(s.levels["bounty"]).toBe(2);
  });

  it("equip rejects slots beyond unlocked count", () => {
    const s = createWardenSlotState();
    grantSubroutine(s, "bounty");
    equipSubroutine(s, 0, "bounty"); // no slots unlocked
    expect(s.equipped[0]).toBeNull();
  });

  it("unlock eligibility gate", () => {
    expect(isWardenUnlockEligible(50, 5)).toBe(false); // cycle short
    expect(isWardenUnlockEligible(100, 2)).toBe(false); // stratum short
    expect(isWardenUnlockEligible(100, 3)).toBe(true);
  });

  it("listSubroutines ships 3", () => {
    expect(listSubroutines().length).toBe(3);
  });
});
