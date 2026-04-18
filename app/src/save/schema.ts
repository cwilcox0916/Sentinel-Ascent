/**
 * Save slot schema. Versioned — every breaking change increments CURRENT_SCHEMA
 * and adds a migration entry in migrations.ts.
 *
 * Spec: docs/my_game/07-save-system-spec.md §4 + §5
 *
 * Storage rules:
 *   - One SaveSlot per slot key (1..5) in the IndexedDB "slots" object store
 *   - JSON-serializable: BigInts (seed, RNG state) are stored as strings
 *   - Mid-run state lives under `runSnapshot` and is null when no run is in progress
 */

import type { UpgradeId } from "../meta/forge.ts";
import type { ResearchBayState } from "../meta/researchBay.ts";
import { createResearchBayState } from "../meta/researchBay.ts";
import type { ProtocolSlotState } from "../meta/protocols.ts";
import { createProtocolSlotState } from "../meta/protocols.ts";
import type { ArsenalSlotState } from "../meta/arsenals.ts";
import { createArsenalSlotState } from "../meta/arsenals.ts";
import type { AugmentSlotState } from "../meta/augments.ts";
import { createAugmentSlotState } from "../meta/augments.ts";
import type { HeirloomSlotState } from "../meta/heirlooms.ts";
import { createHeirloomSlotState } from "../meta/heirlooms.ts";
import type { ConstructSlotState } from "../meta/constructs.ts";
import { createConstructSlotState } from "../meta/constructs.ts";
import type { DailyDropState } from "../econ/dailyDrop.ts";
import { createDailyDropState } from "../econ/dailyDrop.ts";
import type { AchievementState } from "../econ/achievements.ts";
import { createAchievementState } from "../econ/achievements.ts";
import type { WardenSlotState } from "../meta/warden.ts";
import { createWardenSlotState } from "../meta/warden.ts";
import type { OrderState } from "../econ/order.ts";
import { createOrderState } from "../econ/order.ts";
import type { WeeklyTrialState } from "../econ/weeklyTrial.ts";
import { createWeeklyTrialState } from "../econ/weeklyTrial.ts";
import type { ArchiveState } from "../meta/archive.ts";
import { createArchiveState } from "../meta/archive.ts";

export const CURRENT_SCHEMA = 10;

export type SlotId = 1 | 2 | 3 | 4 | 5;
export const SLOT_IDS: ReadonlyArray<SlotId> = [1, 2, 3, 4, 5];

export type ProfileState = {
  displayName: string;
  createdAt: number; // epoch ms
};

/** Persistent currencies. Phase 3: only Alloy/Prism are populated by sim; rest reserved. */
export type CurrencyState = {
  alloy: number;
  prisms: number;
  cores: number;
  insignia: number;
  catalyst: number;
  cipherKeys: number;
  subnodes: number;
  orderMarks: number;
  augmentFragments: number;
  fluxCrystals: number;
};

export const EMPTY_CURRENCIES: CurrencyState = {
  alloy: 0,
  prisms: 0,
  cores: 0,
  insignia: 0,
  catalyst: 0,
  cipherKeys: 0,
  subnodes: 0,
  orderMarks: 0,
  augmentFragments: 0,
  fluxCrystals: 0,
};

/** Serialized BigInts as strings for JSON-safety. */
export type SerializedBigInt = string;

export type SerializedPRNGState = {
  s0: SerializedBigInt;
  s1: SerializedBigInt;
};

export type SerializedSentinelStats = {
  damage: number;
  attackSpeed: number;
  range: number;
  health: number;
  maxHealth: number;
  projectileSpeed: number;
  defensePercent: number;
  thorns: number;
  lifesteal: number;
  scripBonus: number;
  alloyPerKill: number;
};

export type SerializedVec2 = { x: number; y: number };

export type SerializedEnemy = {
  id: number;
  archetype: string;
  pos: SerializedVec2;
  prevPos: SerializedVec2;
  vel: SerializedVec2;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  contactDamage: number;
  alloyReward: number;
  state: string;
  spawnedAtCycle: number;
  attackCooldown: number;
};

export type SerializedEnemyProjectile = {
  id: number;
  pos: SerializedVec2;
  prevPos: SerializedVec2;
  vel: SerializedVec2;
  damage: number;
  lifetime: number;
  radius: number;
};

export type SerializedProjectile = {
  id: number;
  ownerId: string;
  pos: SerializedVec2;
  prevPos: SerializedVec2;
  vel: SerializedVec2;
  damage: number;
  lifetime: number;
  radius: number;
};

export type SerializedForgeState = {
  levels: Record<UpgradeId, number>;
};

export type SerializedAutoProcurement = {
  unlockedTier: number;
  activeTier: number;
  tier1: { enabled: boolean; category: string };
  tier2?: {
    channels: Record<
      string,
      { enabled: boolean; reserve: number }
    >;
  };
  /** Tier 3+ payloads added in Phase 9. Optional for backward compatibility. */
  tier3?: {
    enabled: Record<string, boolean>;
    priority: Record<string, number>;
    lastBoughtTick: Record<string, number>;
    fairnessRoundRobin: boolean;
  };
  tier4?: {
    mode: string;
    rules: Array<{
      id: string;
      name: string;
      enabled: boolean;
      condition: { sensor: string; comparator: string; value: number };
      actions: Array<Record<string, unknown>>;
    }>;
  };
};

export type RunSnapshot = {
  seed: SerializedBigInt;
  rngState: SerializedPRNGState;
  tickNumber: number;
  cycle: number;
  cycleProgressMs: number;
  cycleDurationMs: number;
  cycleEnemyBudget: number;
  cycleSpawnAccumulator: number;
  scrip: number;
  alloy: number;
  baseSentinelStats: SerializedSentinelStats;
  sentinelStats: SerializedSentinelStats;
  sentinelRadius: number;
  sentinelAttackCooldown: number;
  enemies: SerializedEnemy[];
  projectiles: SerializedProjectile[];
  enemyProjectiles: SerializedEnemyProjectile[];
  spawnerState: { behemothSpawnedThisCycle: boolean };
  nextEntityId: number;
  ended: boolean;
  forge: SerializedForgeState;
  autoProcurement: SerializedAutoProcurement;
  stratum?: number;
  stratumScale?: number;
  stats?: { kills: number; damageDealt: number };
  /** Phase 11: per-run Boon selections. */
  boons?: {
    chosen: string[];
    multipliers: { damage: number; attackSpeed: number; range: number };
    flatDelta: {
      maxHealth: number;
      defensePercent: number;
      lifesteal: number;
      scripBonus: number;
      alloyPerKill: number;
    };
    lastOfferedAtCycle: number;
  };
  startedAt: number;
};

export type SettingsState = {
  audioVolume: number; // 0..1
  /** Phase 16: split audio into music vs sfx buses. */
  musicVolume: number;
  sfxVolume: number;
  lowVfx: boolean;
  reducedMotion: boolean;
  /** Phase 15: palette override. "default" | "deuteranopia" | "protanopia" | "tritanopia". */
  colorBlindPalette: "default" | "deuteranopia" | "protanopia" | "tritanopia";
  /** Phase 15: mute auto-buy toast sound. */
  muteAutoBuy: boolean;
  /** Phase 16: opt-in anonymous telemetry. Default OFF per the no-tracking promise. */
  telemetryOptIn: boolean;
  /** Phase 16: key bindings. Map logical action → KeyboardEvent.code. Null uses default. */
  keyBindings: {
    pause: string | null;
    speedUp: string | null;
    speedDown: string | null;
    openLoadout: string | null;
    openResearch: string | null;
  };
  /** Phase 16: gamepad sensitivity (0..1). Reserved; wiring lands with Phase 17 beta. */
  gamepadDeadzone: number;
};

export const DEFAULT_SETTINGS: SettingsState = {
  audioVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  lowVfx: false,
  reducedMotion: false,
  colorBlindPalette: "default",
  muteAutoBuy: true,
  telemetryOptIn: false,
  keyBindings: {
    pause: null,
    speedUp: null,
    speedDown: null,
    openLoadout: null,
    openResearch: null,
  },
  gamepadDeadzone: 0.15,
};

export type SaveSlot = {
  schemaVersion: number;
  slotId: SlotId;
  profile: ProfileState;
  currencies: CurrencyState;
  /** Reserved for the meta-level Forge that arrives in a later phase. */
  metaForge: SerializedForgeState | null;
  /** Research Bay state — persists across runs; research progresses in real time. */
  researchBay: ResearchBayState;
  /** Phase 10: equipment systems. */
  protocols: ProtocolSlotState;
  arsenals: ArsenalSlotState;
  augments: AugmentSlotState;
  heirlooms: HeirloomSlotState;
  constructs: ConstructSlotState;
  /** Phase 12: economy sources. */
  dailyDrop: DailyDropState;
  achievements: AchievementState;
  /** Phase 13: Warden + Order + Weekly Trials. */
  warden: WardenSlotState;
  order: OrderState;
  weeklyTrial: WeeklyTrialState;
  /** Phase 14: Archive tech tree. */
  archive: ArchiveState;
  runSnapshot: RunSnapshot | null;
  /** Currently-selected Stratum in the Hangar. Defaults to 1. */
  selectedStratum: number;
  /** Number of runs ever launched from this slot — used to diversify seeds. */
  runsLaunched: number;
  /** Last completed/ended run summary, surfaced in the Hangar's Last Run card. */
  lastRun: LastRunSummary | null;
  settings: SettingsState;
  metadata: {
    createdAt: number;
    lastPlayedAt: number;
    totalPlayMs: number;
    lastSavedAt: number;
    highestCycle: number;
  };
};

export type LastRunSummary = {
  endedAt: number;
  stratum: number;
  cyclesReached: number;
  alloyEarned: number;
  prismsEarned: number;
  runtimeMs: number;
  causeOfDeath: string;
};

export type SaveSlotSummary = {
  slotId: SlotId;
  occupied: boolean;
  displayName?: string;
  highestCycle?: number;
  totalPlayMs?: number;
  lastPlayedAt?: number;
  hasRunInProgress?: boolean;
};

/** Build a fresh SaveSlot for a new player picking an empty slot. */
export function createEmptySlot(slotId: SlotId, displayName: string): SaveSlot {
  const now = Date.now();
  return {
    schemaVersion: CURRENT_SCHEMA,
    slotId,
    profile: { displayName, createdAt: now },
    currencies: { ...EMPTY_CURRENCIES },
    metaForge: null,
    researchBay: createResearchBayState(),
    protocols: createProtocolSlotState(),
    arsenals: createArsenalSlotState(),
    augments: createAugmentSlotState(),
    heirlooms: createHeirloomSlotState(),
    constructs: createConstructSlotState(),
    dailyDrop: createDailyDropState(),
    achievements: createAchievementState(),
    warden: createWardenSlotState(),
    order: createOrderState(),
    weeklyTrial: createWeeklyTrialState(),
    archive: createArchiveState(),
    runSnapshot: null,
    selectedStratum: 1,
    runsLaunched: 0,
    lastRun: null,
    settings: { ...DEFAULT_SETTINGS },
    metadata: {
      createdAt: now,
      lastPlayedAt: now,
      totalPlayMs: 0,
      lastSavedAt: now,
      highestCycle: 0,
    },
  };
}

/** Pull a quick summary out of a full SaveSlot for the slot picker. */
export function summarizeSlot(slot: SaveSlot | null, slotId: SlotId): SaveSlotSummary {
  if (!slot) return { slotId, occupied: false };
  return {
    slotId,
    occupied: true,
    displayName: slot.profile.displayName,
    highestCycle: slot.metadata.highestCycle,
    totalPlayMs: slot.metadata.totalPlayMs,
    lastPlayedAt: slot.metadata.lastPlayedAt,
    hasRunInProgress: !!slot.runSnapshot,
  };
}
