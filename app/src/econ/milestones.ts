/**
 * Stratum Milestones — guaranteed Prism + Alloy + Core payouts on every 50-Cycle
 * threshold within a run.
 *
 * Spec: docs/my_game/05-currencies-and-economy.md §4 + §5 (Core earn path).
 *
 * This is the "IAP-replacement" pathway for the source-pack monthly Core subs.
 * Rewards scale mildly with Stratum so pushing deeper Strata is always worth it.
 */

import type { SaveSlot } from "../save/schema.ts";
import type { RunState } from "../sim/types.ts";

export const MILESTONE_INTERVAL = 50;

export type MilestoneReward = {
  prisms: number;
  alloy: number;
  cores: number;
  catalyst: number;
};

export type MilestoneGrant = {
  cycle: number;
  stratum: number;
  reward: MilestoneReward;
};

/** Per-run milestone tracker: last Cycle at which we granted. */
export type MilestoneRunState = {
  lastGrantedCycle: number;
};

export function createMilestoneRunState(): MilestoneRunState {
  return { lastGrantedCycle: 0 };
}

export function milestoneRewardFor(stratum: number, cycle: number): MilestoneReward {
  const tier = Math.floor(cycle / MILESTONE_INTERVAL);
  return {
    prisms: 25 + 5 * Math.max(0, stratum - 1),
    alloy: 100 * tier + 50 * Math.max(0, stratum - 1),
    cores: stratum >= 3 ? 2 : 1,
    catalyst: stratum >= 10 ? 1 : 0,
  };
}

/** Called on Cycle rollover in the sim host. Grants any milestones the player
 *  just crossed and returns the grants so the UI can toast them. */
export function checkMilestones(
  slot: SaveSlot,
  run: RunState,
  milestoneState: MilestoneRunState,
): MilestoneGrant[] {
  const grants: MilestoneGrant[] = [];
  // Walk forward from last-granted to current in 50-Cycle steps so a debug
  // jump still grants all thresholds in between.
  let cursor = Math.floor(milestoneState.lastGrantedCycle / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;
  while (cursor + MILESTONE_INTERVAL <= run.cycle) {
    cursor += MILESTONE_INTERVAL;
    const reward = milestoneRewardFor(run.stratum, cursor);
    slot.currencies.prisms += reward.prisms;
    slot.currencies.alloy += reward.alloy;
    slot.currencies.cores += reward.cores;
    slot.currencies.catalyst += reward.catalyst;
    grants.push({ cycle: cursor, stratum: run.stratum, reward });
  }
  milestoneState.lastGrantedCycle = run.cycle;
  return grants;
}
