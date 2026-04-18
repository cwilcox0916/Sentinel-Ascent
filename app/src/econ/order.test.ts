import { describe, it, expect } from "vitest";
import {
  buyShopItem,
  claimWeeklyTier,
  claimableTier,
  createOrderState,
  isoWeek,
  recordContribution,
  rolloverWeek,
  WEEKLY_TIERS,
} from "./order.ts";
import { EMPTY_CURRENCIES } from "../save/schema.ts";

describe("Order", () => {
  it("isoWeek is deterministic for a date", () => {
    const a = isoWeek(new Date("2025-04-18T12:00:00Z"));
    const b = isoWeek(new Date("2025-04-18T23:00:00Z"));
    expect(a).toBe(b);
  });

  it("records contribution", () => {
    const s = createOrderState();
    recordContribution(s, 50);
    recordContribution(s, 60);
    expect(s.weeklyContribution).toBe(110);
  });

  it("claimable tier escalates with contribution", () => {
    const s = createOrderState();
    expect(claimableTier(s)).toBe(-1);
    s.weeklyContribution = 120;
    expect(claimableTier(s)).toBe(0);
    s.weeklyContribution = 260;
    expect(claimableTier(s)).toBe(1);
    s.weeklyContribution = 800;
    expect(claimableTier(s)).toBe(3);
  });

  it("claim grants the tier's rewards once", () => {
    const s = createOrderState();
    const cur = { ...EMPTY_CURRENCIES };
    s.weeklyContribution = 800;
    expect(claimWeeklyTier(s, cur, 0)).toBe("claimed");
    expect(cur.orderMarks).toBe(WEEKLY_TIERS[0]!.marks);
    expect(claimWeeklyTier(s, cur, 0)).toBe("already-claimed");
  });

  it("shop buy respects per-season cap", () => {
    const s = createOrderState();
    const cur = { ...EMPTY_CURRENCIES };
    cur.orderMarks = 1000;
    expect(buyShopItem(s, cur, "prisms-small").ok).toBe(true);
    expect(buyShopItem(s, cur, "prisms-small").ok).toBe(true);
    expect(buyShopItem(s, cur, "prisms-small").ok).toBe(true);
    const fourth = buyShopItem(s, cur, "prisms-small");
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.reason).toBe("season-cap");
  });

  it("rollover resets weekly state and advances season after 8 weeks", () => {
    const s = createOrderState();
    const cur = { ...EMPTY_CURRENCIES };
    cur.orderMarks = 100;
    s.seasonStartWeek -= 8; // simulate 8 weeks past
    s.weekNumberAnchor -= 8;
    const result = rolloverWeek(s, cur, new Date());
    expect(result.seasonEnded).toBe(true);
    expect(result.convertedPrisms).toBeGreaterThan(0);
    expect(cur.orderMarks).toBe(0);
  });
});
