/**
 * Weekly Trials — single-player conversion of Tournaments.
 *
 * Spec: docs/my_game/04-progression-systems.md §16.
 *
 * Each ISO week has a deterministic seed derived from the week number, so every
 * player gets the exact same starting conditions. The local leaderboard records
 * the player's best Cycle-reach for each weekly seed; mapping to Cipher Keys
 * follows a fixed reward table.
 *
 * No backend, no auth — by design. Players can optionally export a JSON ghost
 * replay (deferred to Phase 17 polish) and share out-of-band.
 */

import type { CurrencyState } from "../save/schema.ts";
import { isoWeek } from "./order.ts";

/** Deterministic per-week seed. Same week → same seed across all installs. */
export function weeklyTrialSeed(week: number = isoWeek(new Date())): bigint {
  // Mix the week number through a 64-bit hash (xorshift-style).
  let x = BigInt(week);
  x ^= x << 13n;
  x ^= x >> 7n;
  x ^= x << 17n;
  // Constant offset ensures non-zero, distinct from default seeds.
  return x + 0xCAFEBABEn;
}

/** Map a Cycle reach to Cipher Key reward bracket. */
export function cipherKeysForCycle(cycle: number): number {
  if (cycle >= 200) return 5;
  if (cycle >= 100) return 3;
  if (cycle >= 50) return 2;
  if (cycle >= 25) return 1;
  return 0;
}

export type TrialRecord = {
  weekKey: number;
  bestCycle: number;
  cipherKeysAwarded: number;
  attempts: number;
  lastAttemptAt: number;
};

export type WeeklyTrialState = {
  /** Per-week records keyed by ISO week (year*100 + week). */
  records: Record<number, TrialRecord>;
};

export function createWeeklyTrialState(): WeeklyTrialState {
  return { records: {} };
}

/**
 * Record a finished Trial run. Awards (or tops-up) Cipher Keys based on the
 * difference between the new bracket and the previous best for that week.
 */
export function recordTrialRun(
  state: WeeklyTrialState,
  currencies: CurrencyState,
  cycle: number,
  weekKey: number = isoWeek(new Date()),
  now: number = Date.now(),
): { newBest: boolean; cipherDelta: number } {
  let rec = state.records[weekKey];
  const prev = rec?.bestCycle ?? 0;
  if (!rec) {
    rec = { weekKey, bestCycle: 0, cipherKeysAwarded: 0, attempts: 0, lastAttemptAt: now };
    state.records[weekKey] = rec;
  }
  rec.attempts += 1;
  rec.lastAttemptAt = now;
  if (cycle <= prev) {
    return { newBest: false, cipherDelta: 0 };
  }
  rec.bestCycle = cycle;
  const newReward = cipherKeysForCycle(cycle);
  const delta = Math.max(0, newReward - rec.cipherKeysAwarded);
  rec.cipherKeysAwarded = newReward;
  if (delta > 0) currencies.cipherKeys += delta;
  return { newBest: true, cipherDelta: delta };
}

export function currentWeekRecord(state: WeeklyTrialState): TrialRecord | null {
  return state.records[isoWeek(new Date())] ?? null;
}
