import { describe, it, expect } from "vitest";
import {
  claimDailyDrop,
  createDailyDropState,
  DAILY_DROP_STREAK_CAP,
  getDailyDropStatus,
  payoutFor,
} from "./dailyDrop.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("Daily Drop", () => {
  it("allows the very first claim immediately", () => {
    const s = createDailyDropState();
    const status = getDailyDropStatus(s, 0);
    expect(status.ready).toBe(true);
    if (status.ready) expect(status.payout).toBe(30);
  });

  it("payout scales 30 → 100 over a 7-day streak", () => {
    expect(payoutFor(1)).toBe(30);
    expect(payoutFor(4)).toBe(60);
    expect(payoutFor(DAILY_DROP_STREAK_CAP)).toBe(100);
  });

  it("claim blocked if under 20h has elapsed", () => {
    const s = createDailyDropState();
    const cur = { prisms: 0 };
    claimDailyDrop(s, cur, 0);
    const r = claimDailyDrop(s, cur, 10 * HOUR);
    expect(r.ok).toBe(false);
  });

  it("streak advances when claim is within 48h", () => {
    const s = createDailyDropState();
    const cur = { prisms: 0 };
    claimDailyDrop(s, cur, 0);
    claimDailyDrop(s, cur, 24 * HOUR);
    expect(s.streak).toBe(2);
    expect(cur.prisms).toBe(30 + 40);
  });

  it("streak resets to 1 if claim is beyond 48h", () => {
    const s = createDailyDropState();
    const cur = { prisms: 0 };
    claimDailyDrop(s, cur, 0);
    claimDailyDrop(s, cur, 3 * DAY);
    expect(s.streak).toBe(1);
    expect(cur.prisms).toBe(30 + 30);
  });

  it("streak caps at DAILY_DROP_STREAK_CAP", () => {
    const s = createDailyDropState();
    const cur = { prisms: 0 };
    for (let i = 0; i < 10; i++) {
      claimDailyDrop(s, cur, i * 24 * HOUR);
    }
    expect(s.streak).toBe(DAILY_DROP_STREAK_CAP);
  });
});
