/**
 * Reward grants. Centralizes how Scrip / Alloy land on the RunState so the
 * Forge bonuses (Scrip Bonus, Alloy/Kill) apply in one place.
 *
 * Per docs/my_game/05-currencies-and-economy.md §2 + §3:
 *   - Scrip is in-run, multiplied by Scrip Bonus
 *   - Alloy is permanent, with Alloy/Kill flat bonus on top of base reward
 */

import type { Enemy, RunState } from "./types.ts";
import { heirloomScripMultiplier } from "../meta/heirlooms.ts";
import { wardenAlloyBonus } from "../meta/warden.ts";
import { isFleet } from "./enemies/definitions.ts";
import { nextFloat } from "./rng.ts";

export function grantKillRewards(run: RunState, enemy: Enemy): void {
  const stats = run.sentinel.stats;
  const bountyBonus = wardenAlloyBonus(run, enemy.id);
  const baseAlloy = enemy.alloyReward + stats.alloyPerKill + bountyBonus;
  // Phase 2 keeps Scrip ≈ Alloy/kill until the full Cycle-bonus economy lands in Phase 12.
  const baseScrip = enemy.alloyReward;
  const heirloomMult = heirloomScripMultiplier(run.heirloomSlot);

  run.alloy += baseAlloy;
  run.scrip += Math.floor(baseScrip * (1 + stats.scripBonus) * heirloomMult);
  run.stats.kills += 1;
  // Clear bounty mark so re-collisions don't double-grant.
  if (run.warden) run.warden.bountyMarked.delete(enemy.id);
  // Phase 14: fleet drops. Flux Crystals 80% / Augment Fragments 20% per spec §15.
  if (isFleet(enemy.archetype)) {
    const roll = nextFloat(run.rng);
    if (roll < 0.8) run.fleetDrops.fluxCrystals += 3 + Math.floor(run.stratumScale);
    else run.fleetDrops.augmentFragments += 1 + Math.floor(run.stratumScale / 4);
  }
}
