/**
 * Daily Drop — log-in Prism claim with a 7-day streak ladder.
 *
 * Spec: docs/my_game/05-currencies-and-economy.md §4 + §15 (calibration ~150 Prisms/day).
 *
 * Rules:
 *   - Base claim: 30 Prisms
 *   - Streak bonus: +10 per consecutive day, capped at 100 at day 7
 *   - Streak advances if the player claims between 20h and 48h after the previous
 *     claim (20h grace so daily-reset-time-zone-hop doesn't punish the player;
 *     48h ceiling means missing a day resets the streak)
 *   - Below 20h: claim not ready yet
 *   - Above 48h: claim allowed but streak resets to 1
 */

export const DAILY_DROP_BASE = 30;
export const DAILY_DROP_STREAK_STEP = 10;
export const DAILY_DROP_STREAK_CAP = 7;
export const DAILY_DROP_MIN_INTERVAL_HOURS = 20;
export const DAILY_DROP_STREAK_WINDOW_HOURS = 48;

const HOUR_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = DAILY_DROP_MIN_INTERVAL_HOURS * HOUR_MS;
const STREAK_WINDOW_MS = DAILY_DROP_STREAK_WINDOW_HOURS * HOUR_MS;

export type DailyDropState = {
  /** Wall-clock ms of last claim, or null if never claimed. */
  lastClaimedAt: number | null;
  /** Consecutive-day streak (1..7 at launch). */
  streak: number;
  /** Cumulative total Prisms awarded from Daily Drop across all-time. */
  lifetimeClaimed: number;
};

export function createDailyDropState(): DailyDropState {
  return { lastClaimedAt: null, streak: 0, lifetimeClaimed: 0 };
}

export type DailyDropStatus =
  | { ready: true; nextStreak: number; payout: number }
  | { ready: false; reason: "waiting"; readyInMs: number };

export function getDailyDropStatus(state: DailyDropState, now: number): DailyDropStatus {
  if (state.lastClaimedAt == null) {
    return { ready: true, nextStreak: 1, payout: payoutFor(1) };
  }
  const since = now - state.lastClaimedAt;
  if (since < MIN_INTERVAL_MS) {
    return { ready: false, reason: "waiting", readyInMs: MIN_INTERVAL_MS - since };
  }
  const streakContinues = since <= STREAK_WINDOW_MS;
  const nextStreak = streakContinues ? Math.min(state.streak + 1, DAILY_DROP_STREAK_CAP) : 1;
  return { ready: true, nextStreak, payout: payoutFor(nextStreak) };
}

export function payoutFor(streak: number): number {
  const s = Math.max(1, Math.min(DAILY_DROP_STREAK_CAP, streak));
  // Spec: 30 base, scaling to 100 at day 7. Days 1..6 step by 10; day 7 is a
  // plateau reward of 100 so the streak ladder has a satisfying cap.
  if (s >= DAILY_DROP_STREAK_CAP) return 100;
  return DAILY_DROP_BASE + (s - 1) * DAILY_DROP_STREAK_STEP;
}

export type ClaimResult =
  | { ok: true; payout: number; streak: number }
  | { ok: false; reason: "not-ready"; readyInMs: number };

export function claimDailyDrop(
  state: DailyDropState,
  currencies: { prisms: number },
  now: number,
): ClaimResult {
  const status = getDailyDropStatus(state, now);
  if (!status.ready) return { ok: false, reason: "not-ready", readyInMs: status.readyInMs };
  state.lastClaimedAt = now;
  state.streak = status.nextStreak;
  state.lifetimeClaimed += status.payout;
  currencies.prisms += status.payout;
  return { ok: true, payout: status.payout, streak: status.nextStreak };
}
