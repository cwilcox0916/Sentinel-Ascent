/**
 * UI-facing read-only projection of RunState + action handlers.
 *
 * - The sim mutates RunState every tick. The store re-publishes a summary at
 *   ~10 Hz (HUD-friendly cadence) so React doesn't re-render every sim tick.
 * - Actions (e.g. buyUpgrade) are registered by the run host (Stage.tsx) and
 *   delegate into the live RunState mutator.
 *
 * See docs/my_game/06-architecture-and-tech-stack.md §8.
 */

import { create } from "zustand";
import type { RunState } from "../sim/types.ts";
import {
  listUpgradesByCategory,
  nextCost,
  type UpgradeCategory,
  type UpgradeId,
} from "../meta/forge.ts";
import type { AutoProcurementTier, Rule } from "../sim/autoProcurement.ts";
import type { RunLogSnapshot } from "../meta/runLog.ts";
import type { ProtocolId, ProtocolSlotState } from "../meta/protocols.ts";
import type { ArsenalId, ArsenalSlotState } from "../meta/arsenals.ts";
import type { AugmentId, AugmentSlotState } from "../meta/augments.ts";
import type { BoonId } from "../meta/boons.ts";
import type { HeirloomId, HeirloomSlotState } from "../meta/heirlooms.ts";
import type { ConstructId, ConstructSlotState } from "../meta/constructs.ts";

export type RunSummary = {
  cycle: number;
  cycleProgress: number; // 0..1
  scrip: number;
  alloy: number;
  health: number;
  maxHealth: number;
  enemyCount: number;
  ended: boolean;
  behemoth: { alive: boolean; hp: number; maxHp: number } | null;
  cyclesToNextBehemoth: number;
  /** Phase 10: true while Protocols are locked (Behemoth alive). */
  protocolsLocked: boolean;
  /** Phase 10: seconds remaining per Arsenal on cooldown. */
  arsenalCooldowns: Record<ArsenalId, number>;
  /** Phase 11: pending Boon offer, or null. */
  boonOffer: { atCycle: number; options: BoonId[] } | null;
  /** Phase 11: Boons chosen this run. */
  boonsChosen: BoonId[];
};

export type LoadoutView = {
  protocols: ProtocolSlotState;
  arsenals: ArsenalSlotState;
  augments: AugmentSlotState;
  heirlooms: HeirloomSlotState;
  constructs: ConstructSlotState;
};

export type ForgeRowView = {
  id: UpgradeId;
  name: string;
  level: number;
  cost: number;
  affordable: boolean;
  statLine: string;
};

export type AutoProcurementView = {
  unlockedTier: 0 | AutoProcurementTier;
  activeTier: 0 | AutoProcurementTier;
  tier1Enabled: boolean;
  tier1Category: UpgradeCategory;
  tier2Channels: Record<UpgradeCategory, { enabled: boolean; reserve: number }>;
  tier3: {
    enabled: Record<UpgradeId, boolean>;
    priority: Record<UpgradeId, number>;
    fairnessRoundRobin: boolean;
  };
  tier4: {
    rules: Rule[];
    mode: "first-match" | "all-match";
  };
};

export type DefeatRewards = {
  alloy: number;
  catalyst: number;
  prisms: number;
  cipher: number;
};

export type DefeatSummary = {
  stratum: number;
  causeOfDeath: string;
  causeDetail: string;
  scripEarned: number;
  alloyEarned: number;
  personalBestCycle: number;
  personalBestDelta: number; // cyclesReached - PB (negative = below PB)
  log: RunLogSnapshot;
  rewards: DefeatRewards;
  heirloomDrop: { name: string; rarity: string } | null;
};

export type AutoBuyToast = {
  key: string;
  upgradeId: UpgradeId;
  category: UpgradeCategory;
  cost: number;
  upgradeName: string;
  bornAt: number;
};

const INITIAL: RunSummary = {
  cycle: 1,
  cycleProgress: 0,
  scrip: 0,
  alloy: 0,
  health: 100,
  maxHealth: 100,
  enemyCount: 0,
  ended: false,
  behemoth: null,
  cyclesToNextBehemoth: 10,
  protocolsLocked: false,
  arsenalCooldowns: { "arc-cascade": 0, "seeker-salvo": 0, "stasis-field": 0 },
  boonOffer: null,
  boonsChosen: [],
};

type Actions = {
  equipProtocol: (slotIx: number, id: ProtocolId | null) => void;
  levelUpProtocol: (id: ProtocolId) => void;
  buyProtocolCopy: (id: ProtocolId) => void;
  equipAugment: (slotIx: number, id: AugmentId | null) => void;
  buyAugmentLevel: (id: AugmentId) => void;
  toggleArsenalEquipped: (id: ArsenalId, enabled: boolean) => void;
  buyArsenalLevel: (id: ArsenalId) => void;
  chooseBoon: (id: BoonId) => void;
  equipHeirloom: (slotIx: number, id: HeirloomId | null) => void;
  equipConstruct: (id: ConstructId | null) => void;
  buyUpgrade: (id: UpgradeId) => void;
  setAutoProcurementCategory: (category: UpgradeCategory) => void;
  setAutoProcurementEnabled: (enabled: boolean) => void;
  setTier2ChannelEnabled: (category: UpgradeCategory, enabled: boolean) => void;
  setTier2ChannelReserve: (category: UpgradeCategory, reserve: number) => void;
  setTier3StatEnabled: (id: UpgradeId, enabled: boolean) => void;
  setTier3StatPriority: (id: UpgradeId, priority: number) => void;
  setTier3Fairness: (on: boolean) => void;
  addTier4Rule: (templateName: string) => void;
  removeTier4Rule: (ruleId: string) => void;
  toggleTier4Rule: (ruleId: string, enabled: boolean) => void;
  setTier4Mode: (mode: "first-match" | "all-match") => void;
  setActiveTier: (tier: 1 | 2 | 3 | 4) => void;
};

type Store = {
  summary: RunSummary;
  forgeRows: Record<UpgradeCategory, ForgeRowView[]>;
  autoProcurement: AutoProcurementView;
  loadout: LoadoutView | null;
  /** Recent auto-buys, used to apply .auto-bought keyframe and render toasts. */
  autoBuyToasts: AutoBuyToast[];
  /** UpgradeId → tickNumber of last auto-buy. UI uses this to flash .auto-bought briefly. */
  recentAutoBuys: Record<UpgradeId, number>;
  defeat: DefeatSummary | null;
  actions: Actions | null;
  setSummary: (s: RunSummary) => void;
  setDefeat: (d: DefeatSummary | null) => void;
  setForgeRows: (rows: Record<UpgradeCategory, ForgeRowView[]>) => void;
  setAutoProcurement: (v: AutoProcurementView) => void;
  setLoadout: (l: LoadoutView) => void;
  pushAutoBuyToast: (t: AutoBuyToast) => void;
  reapAutoBuyToasts: () => void;
  setRecentAutoBuys: (m: Record<UpgradeId, number>) => void;
  registerActions: (a: Actions) => void;
};

const EMPTY_FORGE: Record<UpgradeCategory, ForgeRowView[]> = {
  attack: [],
  defense: [],
  utility: [],
};

const EMPTY_TIER3_MAP = {} as Record<UpgradeId, boolean>;
const EMPTY_TIER3_PRIO = {} as Record<UpgradeId, number>;
const EMPTY_TIER2_CHANNELS: Record<UpgradeCategory, { enabled: boolean; reserve: number }> = {
  attack: { enabled: true, reserve: 0 },
  defense: { enabled: true, reserve: 0 },
  utility: { enabled: true, reserve: 0 },
};

const INITIAL_AP: AutoProcurementView = {
  unlockedTier: 1,
  activeTier: 1,
  tier1Enabled: false,
  tier1Category: "defense",
  tier2Channels: EMPTY_TIER2_CHANNELS,
  tier3: { enabled: EMPTY_TIER3_MAP, priority: EMPTY_TIER3_PRIO, fairnessRoundRobin: true },
  tier4: { rules: [], mode: "first-match" },
};

const TOAST_LIFETIME_MS = 2800;

export const useRunStore = create<Store>((set, get) => ({
  summary: INITIAL,
  forgeRows: EMPTY_FORGE,
  autoProcurement: INITIAL_AP,
  loadout: null as LoadoutView | null,
  autoBuyToasts: [],
  recentAutoBuys: {} as Record<UpgradeId, number>,
  defeat: null,
  actions: null,
  setSummary: (summary) => set({ summary }),
  setDefeat: (defeat) => set({ defeat }),
  setForgeRows: (forgeRows) => set({ forgeRows }),
  setAutoProcurement: (autoProcurement) => set({ autoProcurement }),
  setLoadout: (loadout) => set({ loadout }),
  pushAutoBuyToast: (t) =>
    set({ autoBuyToasts: [...get().autoBuyToasts, t].slice(-6) }),
  reapAutoBuyToasts: () => {
    const now = Date.now();
    const live = get().autoBuyToasts.filter((t) => now - t.bornAt < TOAST_LIFETIME_MS);
    if (live.length !== get().autoBuyToasts.length) set({ autoBuyToasts: live });
  },
  setRecentAutoBuys: (recentAutoBuys) => set({ recentAutoBuys }),
  registerActions: (actions) => set({ actions }),
}));

export function projectRun(run: RunState): RunSummary {
  let behemoth: { alive: boolean; hp: number; maxHp: number } | null = null;
  for (const e of run.enemies) {
    if (e.archetype === "behemoth" && e.state !== "dying") {
      behemoth = { alive: true, hp: e.hp, maxHp: e.maxHp };
      break;
    }
  }
  return {
    cycle: run.cycle,
    cycleProgress: Math.min(1, run.cycleProgressMs / run.cycleDurationMs),
    scrip: run.scrip,
    alloy: run.alloy,
    health: run.sentinel.stats.health,
    maxHealth: run.sentinel.stats.maxHealth,
    enemyCount: run.enemies.length,
    ended: run.ended,
    behemoth,
    cyclesToNextBehemoth: cyclesToNextBehemothFromCycle(run.cycle),
    protocolsLocked: !!behemoth,
    arsenalCooldowns: {
      "arc-cascade": 0,
      "seeker-salvo": run.arsenals.cooldowns["seeker-salvo"],
      "stasis-field": run.arsenals.cooldowns["stasis-field"],
    },
    boonOffer: run.boons.pending ? { ...run.boons.pending, options: run.boons.pending.options.slice() } : null,
    boonsChosen: run.boons.chosen.slice(),
  };
}

export function projectLoadout(run: RunState): LoadoutView | null {
  if (!run.protocolSlot || !run.arsenalSlot || !run.augmentSlot) return null;
  return {
    protocols: {
      unlockedSlots: run.protocolSlot.unlockedSlots,
      equipped: [...run.protocolSlot.equipped],
      levels: { ...run.protocolSlot.levels },
      copies: { ...run.protocolSlot.copies },
    },
    arsenals: {
      levels: { ...run.arsenalSlot.levels },
      equipped: { ...run.arsenalSlot.equipped },
    },
    augments: {
      unlockedSlots: run.augmentSlot.unlockedSlots,
      equipped: [...run.augmentSlot.equipped],
      levels: { ...run.augmentSlot.levels },
    },
    heirlooms: run.heirloomSlot
      ? { owned: { ...run.heirloomSlot.owned }, equipped: [...run.heirloomSlot.equipped] }
      : { owned: {} as HeirloomSlotState["owned"], equipped: [] },
    constructs: run.constructSlot
      ? { owned: { ...run.constructSlot.owned }, equipped: run.constructSlot.equipped }
      : { owned: {} as ConstructSlotState["owned"], equipped: null },
  };
}

function cyclesToNextBehemothFromCycle(cycle: number): number {
  const interval = 10;
  return interval - (cycle % interval);
}

export function projectForgeRows(run: RunState): Record<UpgradeCategory, ForgeRowView[]> {
  const out: Record<UpgradeCategory, ForgeRowView[]> = { attack: [], defense: [], utility: [] };
  for (const cat of ["attack", "defense", "utility"] as const) {
    for (const def of listUpgradesByCategory(cat)) {
      const level = run.forge.levels[def.id];
      const cost = nextCost(def, level);
      out[cat].push({
        id: def.id,
        name: def.name,
        level,
        cost,
        affordable: run.scrip >= cost,
        statLine: def.formatStat(run.sentinel.stats, level + 1),
      });
    }
  }
  return out;
}

export function projectAutoProcurement(run: RunState): AutoProcurementView {
  const ap = run.autoProcurement;
  return {
    unlockedTier: ap.unlockedTier,
    activeTier: ap.activeTier,
    tier1Enabled: ap.tier1.enabled,
    tier1Category: ap.tier1.category,
    tier2Channels: {
      attack: { ...ap.tier2.channels.attack },
      defense: { ...ap.tier2.channels.defense },
      utility: { ...ap.tier2.channels.utility },
    },
    tier3: {
      enabled: { ...ap.tier3.enabled },
      priority: { ...ap.tier3.priority },
      fairnessRoundRobin: ap.tier3.fairnessRoundRobin,
    },
    tier4: {
      rules: ap.tier4.rules.map((r) => ({
        ...r,
        condition: { ...r.condition },
        actions: r.actions.map((a) => ({ ...a })),
      })),
      mode: ap.tier4.mode,
    },
  };
}
