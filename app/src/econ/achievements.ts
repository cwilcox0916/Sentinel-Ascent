/**
 * Achievement Vault — 20 launch achievements with Prism payouts.
 *
 * Spec: docs/my_game/05-currencies-and-economy.md §4 + §15, docs/my_game/04-progression-systems.md §15.
 *
 * The source pack's ~200-achievement roster is deferred; this phase ships the
 * 20 most impactful "first-hundred-hours" milestones. Unlocks are detected from
 * sim events (Cycle reached, Behemoth killed, Arsenal acquired, etc.) and surface
 * a claim-side flow (Prisms are granted only when the player explicitly claims).
 *
 * Sources of unlock detection:
 *   - `checkCycleAchievements(slot, run)` — called on Cycle rollover
 *   - `checkRunEndAchievements(slot, defeat)` — called when a run ends
 *   - `checkPurchaseAchievements(slot)` — called after any meta purchase
 *   - `checkLoadoutAchievements(slot)` — called on equip / level-up
 */

import type { SaveSlot } from "../save/schema.ts";
import type { RunState } from "../sim/types.ts";
import { listProtocols } from "../meta/protocols.ts";
import { listArsenals } from "../meta/arsenals.ts";

export type AchievementId =
  // Combat milestones
  | "cycle-25"
  | "cycle-50"
  | "cycle-100"
  | "cycle-200"
  | "first-behemoth"
  | "kill-100"
  | "kill-1000"
  // Progression
  | "first-protocol"
  | "first-arsenal"
  | "first-augment"
  | "first-heirloom"
  | "first-construct"
  | "three-protocols-equipped"
  | "research-first-project"
  | "auto-procurement-t1"
  | "auto-procurement-t2"
  // Economy
  | "earn-1000-alloy"
  | "earn-10000-alloy"
  // Boons
  | "first-boon"
  | "five-boons";

export type AchievementDefinition = {
  id: AchievementId;
  name: string;
  description: string;
  /** Prism reward on claim. */
  reward: number;
};

const ACHIEVEMENTS: AchievementDefinition[] = [
  { id: "cycle-25", name: "First Survivor", description: "Reach Cycle 25.", reward: 15 },
  { id: "cycle-50", name: "Deep Cycle", description: "Reach Cycle 50.", reward: 25 },
  { id: "cycle-100", name: "Centurion", description: "Reach Cycle 100.", reward: 50 },
  { id: "cycle-200", name: "Long-Haul", description: "Reach Cycle 200.", reward: 100 },
  { id: "first-behemoth", name: "Behemoth Slayer", description: "Defeat your first Behemoth.", reward: 20 },
  { id: "kill-100", name: "Centurion Kills", description: "Defeat 100 enemies across a single run.", reward: 10 },
  { id: "kill-1000", name: "Thousandcutter", description: "Defeat 1000 enemies across a single run.", reward: 75 },

  { id: "first-protocol", name: "Protocol Armed", description: "Acquire your first Protocol.", reward: 10 },
  { id: "first-arsenal", name: "Arsenal Online", description: "Acquire your first Arsenal.", reward: 15 },
  { id: "first-augment", name: "Augment Fitted", description: "Acquire your first Augment.", reward: 10 },
  { id: "first-heirloom", name: "Heritage Equipped", description: "Equip your first Heirloom.", reward: 50 },
  { id: "first-construct", name: "Assist Deployed", description: "Equip your first Construct.", reward: 25 },
  { id: "three-protocols-equipped", name: "Stack Complete", description: "Equip 3 Protocols at once.", reward: 20 },
  { id: "research-first-project", name: "Research Launched", description: "Complete your first Research Bay project.", reward: 20 },
  { id: "auto-procurement-t1", name: "Hands Off", description: "Research Auto-Procurement Tier 1.", reward: 30 },
  { id: "auto-procurement-t2", name: "Multi-Channel", description: "Research Auto-Procurement Tier 2.", reward: 75 },

  { id: "earn-1000-alloy", name: "First Fortune", description: "Earn 1,000 Alloy (lifetime).", reward: 15 },
  { id: "earn-10000-alloy", name: "Industrialist", description: "Earn 10,000 Alloy (lifetime).", reward: 50 },

  { id: "first-boon", name: "Blessed", description: "Accept your first Boon.", reward: 10 },
  { id: "five-boons", name: "Empowered", description: "Accept 5 Boons in a single run.", reward: 40 },
];

export function listAchievements(): ReadonlyArray<AchievementDefinition> {
  return ACHIEVEMENTS;
}

export function getAchievement(id: AchievementId): AchievementDefinition {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown achievement: ${id}`);
  return a;
}

/** Persistent achievement state on the SaveSlot. */
export type AchievementState = {
  unlocked: Record<AchievementId, boolean>;
  claimed: Record<AchievementId, boolean>;
  /** Running lifetime Alloy total — drives earn-N-alloy achievements. */
  lifetimeAlloyEarned: number;
};

export function createAchievementState(): AchievementState {
  const unlocked = {} as Record<AchievementId, boolean>;
  const claimed = {} as Record<AchievementId, boolean>;
  for (const a of ACHIEVEMENTS) {
    unlocked[a.id] = false;
    claimed[a.id] = false;
  }
  return { unlocked, claimed, lifetimeAlloyEarned: 0 };
}

/** Mark an achievement unlocked. Idempotent — returns true if newly unlocked. */
export function unlock(state: AchievementState, id: AchievementId): boolean {
  if (state.unlocked[id]) return false;
  state.unlocked[id] = true;
  return true;
}

/** Claim a previously-unlocked achievement for its Prism payout. */
export function claimAchievement(
  state: AchievementState,
  currencies: { prisms: number },
  id: AchievementId,
): "claimed" | "not-unlocked" | "already-claimed" {
  if (!state.unlocked[id]) return "not-unlocked";
  if (state.claimed[id]) return "already-claimed";
  state.claimed[id] = true;
  currencies.prisms += getAchievement(id).reward;
  return "claimed";
}

/* ================ Detection hooks ================ */

/** Called on Cycle rollover. Returns newly-unlocked ids. */
export function checkCycleAchievements(slot: SaveSlot, run: RunState): AchievementId[] {
  const out: AchievementId[] = [];
  const state = slot.achievements;
  if (!state) return out;
  if (run.cycle >= 25 && unlock(state, "cycle-25")) out.push("cycle-25");
  if (run.cycle >= 50 && unlock(state, "cycle-50")) out.push("cycle-50");
  if (run.cycle >= 100 && unlock(state, "cycle-100")) out.push("cycle-100");
  if (run.cycle >= 200 && unlock(state, "cycle-200")) out.push("cycle-200");
  if (run.stats.kills >= 100 && unlock(state, "kill-100")) out.push("kill-100");
  if (run.stats.kills >= 1000 && unlock(state, "kill-1000")) out.push("kill-1000");
  if (run.boons.chosen.length >= 1 && unlock(state, "first-boon")) out.push("first-boon");
  if (run.boons.chosen.length >= 5 && unlock(state, "five-boons")) out.push("five-boons");
  return out;
}

/** Called when a Behemoth dies during the run. */
export function recordBehemothKill(slot: SaveSlot): AchievementId[] {
  const state = slot.achievements;
  if (!state) return [];
  return unlock(state, "first-behemoth") ? ["first-behemoth"] : [];
}

/** Called when meta purchases happen. */
export function checkLoadoutAchievements(slot: SaveSlot): AchievementId[] {
  const out: AchievementId[] = [];
  const state = slot.achievements;
  if (!state) return out;
  const protoLevels = Object.values(slot.protocols.levels);
  if (protoLevels.some((l) => l > 0) && unlock(state, "first-protocol")) out.push("first-protocol");
  const arsenalLevels = Object.values(slot.arsenals.levels);
  if (arsenalLevels.some((l) => l > 0) && unlock(state, "first-arsenal")) out.push("first-arsenal");
  const augmentLevels = Object.values(slot.augments.levels);
  if (augmentLevels.some((l) => l > 0) && unlock(state, "first-augment")) out.push("first-augment");
  const equippedProtocols = slot.protocols.equipped.filter((e) => !!e).length;
  if (equippedProtocols >= 3 && unlock(state, "three-protocols-equipped")) {
    out.push("three-protocols-equipped");
  }
  const equippedHeirloom = slot.heirlooms.equipped.some((e) => !!e);
  if (equippedHeirloom && unlock(state, "first-heirloom")) out.push("first-heirloom");
  if (slot.constructs.equipped != null && unlock(state, "first-construct")) out.push("first-construct");
  return out;
}

/** Called when Research Bay project completes. */
export function checkResearchAchievements(slot: SaveSlot, projectId: string): AchievementId[] {
  const state = slot.achievements;
  if (!state) return [];
  const out: AchievementId[] = [];
  // Any project → first-research.
  if (unlock(state, "research-first-project")) out.push("research-first-project");
  if (projectId === "autoProcurement_T1" && unlock(state, "auto-procurement-t1")) out.push("auto-procurement-t1");
  if (projectId === "autoProcurement_T2" && unlock(state, "auto-procurement-t2")) out.push("auto-procurement-t2");
  return out;
}

/** Called when Alloy is earned (after grantKillRewards) to keep lifetime total current. */
export function recordAlloyEarned(slot: SaveSlot, amount: number): AchievementId[] {
  const state = slot.achievements;
  if (!state) return [];
  state.lifetimeAlloyEarned += amount;
  const out: AchievementId[] = [];
  if (state.lifetimeAlloyEarned >= 1000 && unlock(state, "earn-1000-alloy")) out.push("earn-1000-alloy");
  if (state.lifetimeAlloyEarned >= 10_000 && unlock(state, "earn-10000-alloy")) out.push("earn-10000-alloy");
  return out;
}

// Re-exports for UI (avoid unused warnings; these catalogues drive detail panels).
void listProtocols;
void listArsenals;
