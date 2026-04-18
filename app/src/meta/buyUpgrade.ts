/**
 * Forge purchase action — runs inside the sim's data ownership boundary.
 * Called from React via the registered action on `runStore`.
 */

import type { RunState, SentinelStats } from "../sim/types.ts";
import { applyForge, getUpgrade, nextCost, type UpgradeId } from "./forge.ts";
import { applyProtocols } from "./protocols.ts";
import { applyAugments } from "./augments.ts";
import { applyHeirloomStats } from "./heirlooms.ts";
import { applyConstructStats } from "./constructs.ts";
import { applyBoons } from "./boons.ts";
import { applyArchiveStats } from "./archive.ts";

export type BuyResult = "bought" | "unaffordable" | "ended";

/**
 * Phase 11: rebuild Sentinel stats from the full layer stack.
 *
 * Layer order (outermost in):
 *   base → Heirlooms → Protocols → Augments → Constructs → Forge → Boons
 *
 * Heirlooms are permanent multipliers so they layer onto raw base first.
 * Boons are this-run-only deltas and apply last so they don't double up with
 * mid-run Forge compounds.
 */
export function recomputeSentinelStats(run: RunState): void {
  applyForge(run.baseSentinelStats, run.forge, run.sentinel.stats, (s: SentinelStats) => {
    if (run.archive) applyArchiveStats(run.archive, s); // Phase 14: permanent techs layer under Heirlooms
    if (run.heirloomSlot) applyHeirloomStats(run.heirloomSlot, s);
    if (run.protocolSlot) applyProtocols(run.protocolSlot, s);
    if (run.augmentSlot) applyAugments(run.augmentSlot, s);
    if (run.constructSlot) applyConstructStats(run.constructSlot, s);
  });
  // Boons apply AFTER Forge so multipliers hit the already-compounded baseline.
  if (run.boons) applyBoons(run.boons, run.sentinel.stats);
}

export function buyUpgrade(run: RunState, id: UpgradeId): BuyResult {
  if (run.ended) return "ended";

  const def = getUpgrade(id);
  const level = run.forge.levels[id];
  const cost = nextCost(def, level);
  if (run.scrip < cost) return "unaffordable";

  run.scrip -= cost;
  run.forge.levels[id] = level + 1;
  recomputeSentinelStats(run);
  return "bought";
}
