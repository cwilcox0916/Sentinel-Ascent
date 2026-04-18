/**
 * Auto-Procurement — automated in-run upgrade purchasing.
 *
 * Tiers implemented:
 *   - Tier 1 (Phase 4): single-channel, cheapest-in-category auto-buy
 *   - Tier 2 (Phase 6): multi-channel with per-category Scrip reserve floors
 *   - Tier 3 (Phase 9): per-stat enabled + priority 1..10 + round-robin fairness
 *   - Tier 4 (Phase 9): rules engine (sensors, comparators, actions) overriding
 *     the Tier 3 targeted configuration when conditions match
 *
 * Spec: docs/my_game/08-auto-procurement-spec.md §§6–9.
 *
 * Determinism: this runs inside `simulateTick` at a fixed position (after enemy
 * update, before Sentinel firing — see tick.ts). Same seed + same player toggles
 * → identical purchase sequence.
 *
 * Save: state lives on RunState and rides along in the snapshot via save/snapshot.ts.
 */

import type { RunState } from "./types.ts";
import {
  getUpgrade,
  listUpgrades,
  listUpgradesByCategory,
  nextCost,
  type UpgradeCategory,
  type UpgradeDefinition,
  type UpgradeId,
} from "../meta/forge.ts";
import { buyUpgrade } from "../meta/buyUpgrade.ts";

export type AutoProcurementTier = 1 | 2 | 3 | 4;

export type Tier1Config = {
  enabled: boolean;
  category: UpgradeCategory;
};

/** Tier 2 adds per-category on/off + per-category Scrip reserve floor. */
export type Tier2Config = {
  channels: Record<UpgradeCategory, { enabled: boolean; reserve: number }>;
};

/** Tier 3 adds per-stat toggle + priority + round-robin fairness. */
export type Tier3Config = {
  enabled: Record<UpgradeId, boolean>;
  /** 1 = low priority, 10 = highest. Default 5. */
  priority: Record<UpgradeId, number>;
  /** Ticks since last purchase, used by round-robin tie-breaking. */
  lastBoughtTick: Record<UpgradeId, number>;
  fairnessRoundRobin: boolean;
};

/** Tier 4 rule grammar (sensors, comparators, actions). Kept simple — see spec §9. */
export type Sensor =
  | "sentinel.hpPercent"
  | "cycle"
  | "cycle.isBoss"
  | "scrip"
  | "enemiesAlive"
  | "runDurationSeconds";

export type Comparator = "<" | "<=" | ">" | ">=" | "==" | "!=";

export type Action =
  | { kind: "SET_PRIORITY"; statId: UpgradeId; priority: number }
  | { kind: "DISABLE_CATEGORY"; category: UpgradeCategory }
  | { kind: "ENABLE_CATEGORY"; category: UpgradeCategory }
  | { kind: "PAUSE_AUTO_BUY" }
  | { kind: "ONLY_BUY"; statIds: UpgradeId[] };

export type RuleCondition = {
  sensor: Sensor;
  comparator: Comparator;
  /** Percent sensors compare on 0..100; hpPercent stored as 0..100 in the value. */
  value: number;
};

export type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  /** Currently a single condition; AND/OR composition reserved for later. */
  condition: RuleCondition;
  actions: Action[];
};

export type Tier4Config = {
  rules: Rule[];
  mode: "first-match" | "all-match";
};

export type AutoBuyPulse = {
  upgradeId: UpgradeId;
  category: UpgradeCategory;
  cost: number;
  tickNumber: number;
};

export type AutoProcurementState = {
  /** Highest researched tier. 0 = nothing researched; set by Research Bay. */
  unlockedTier: 0 | AutoProcurementTier;
  /** Player can downshift to any researched tier. */
  activeTier: 0 | AutoProcurementTier;
  tier1: Tier1Config;
  tier2: Tier2Config;
  tier3: Tier3Config;
  tier4: Tier4Config;
  /** Append-only ring of recent auto-buys; UI drains and renders pulses + toasts. */
  pulses: AutoBuyPulse[];
};

const PULSE_RING_MAX = 32;

/* ================ Canned Tier 4 rule templates (spec §9). ================ */

export const RULE_TEMPLATES: ReadonlyArray<Omit<Rule, "id" | "enabled">> = [
  {
    name: "Defensive Stand",
    condition: { sensor: "sentinel.hpPercent", comparator: "<", value: 50 },
    actions: [{ kind: "ONLY_BUY", statIds: ["health", "defensePercent", "thorns"] }],
  },
  {
    name: "Boss Cycle Focus",
    condition: { sensor: "cycle.isBoss", comparator: "==", value: 1 },
    actions: [
      { kind: "DISABLE_CATEGORY", category: "utility" },
      { kind: "SET_PRIORITY", statId: "damage", priority: 10 },
    ],
  },
  {
    name: "Save For Wall",
    condition: { sensor: "scrip", comparator: "<", value: 500 },
    actions: [{ kind: "PAUSE_AUTO_BUY" }],
  },
  {
    name: "Late-Run Economy Tilt",
    condition: { sensor: "runDurationSeconds", comparator: ">", value: 1200 },
    actions: [
      { kind: "SET_PRIORITY", statId: "scripBonus", priority: 10 },
      { kind: "SET_PRIORITY", statId: "alloyPerKill", priority: 9 },
    ],
  },
  {
    name: "Swarm Lockdown",
    condition: { sensor: "enemiesAlive", comparator: ">=", value: 20 },
    actions: [{ kind: "ONLY_BUY", statIds: ["damage", "attackSpeed", "range"] }],
  },
];

/* ================ Factories ================ */

export function createAutoProcurementState(): AutoProcurementState {
  return {
    unlockedTier: 0,
    activeTier: 0,
    tier1: { enabled: false, category: "defense" },
    tier2: {
      channels: {
        attack: { enabled: true, reserve: 0 },
        defense: { enabled: true, reserve: 0 },
        utility: { enabled: true, reserve: 0 },
      },
    },
    tier3: createTier3Defaults(),
    tier4: { rules: [], mode: "first-match" },
    pulses: [],
  };
}

export function createTier3Defaults(): Tier3Config {
  const enabled = {} as Record<UpgradeId, boolean>;
  const priority = {} as Record<UpgradeId, number>;
  const lastBoughtTick = {} as Record<UpgradeId, number>;
  for (const u of listUpgrades()) {
    enabled[u.id] = true;
    priority[u.id] = 5;
    lastBoughtTick[u.id] = 0;
  }
  return { enabled, priority, lastBoughtTick, fairnessRoundRobin: true };
}

/* ================ Evaluator (tick order §5) ================ */

type ResolvedPolicy = {
  /** Final per-stat priority after Tier 4 SET_PRIORITY overrides. */
  priority: Record<UpgradeId, number>;
  /** Final per-stat enabled after ONLY_BUY / disabled-category overrides. */
  enabled: Record<UpgradeId, boolean>;
  pause: boolean;
  fairnessRoundRobin: boolean;
};

export function evaluateAutoProcurement(run: RunState): void {
  const ap = run.autoProcurement;
  if (!ap || run.ended || ap.activeTier < 1) return;

  if (ap.activeTier >= 3) {
    evaluateTier3OrHigher(run);
    return;
  }

  if (ap.activeTier === 2) {
    evaluateTier2(run);
    return;
  }

  evaluateTier1(run);
}

function evaluateTier1(run: RunState): void {
  const ap = run.autoProcurement;
  if (!ap.tier1.enabled) return;
  const target = pickCheapestAffordableWithin(run, ap.tier1.category, run.scrip);
  if (!target) return;
  const result = buyUpgrade(run, target.def.id);
  if (result === "bought") {
    pushPulse(ap, {
      upgradeId: target.def.id,
      category: ap.tier1.category,
      cost: target.cost,
      tickNumber: run.tickNumber,
    });
    ap.tier3.lastBoughtTick[target.def.id] = run.tickNumber;
  }
}

function evaluateTier2(run: RunState): void {
  const ap = run.autoProcurement;
  for (const cat of ["attack", "defense", "utility"] as const) {
    const cfg = ap.tier2.channels[cat];
    if (!cfg.enabled) continue;
    const available = run.scrip - cfg.reserve;
    if (available <= 0) continue;
    const target = pickCheapestAffordableWithin(run, cat, available);
    if (!target) continue;
    const result = buyUpgrade(run, target.def.id);
    if (result === "bought") {
      pushPulse(ap, {
        upgradeId: target.def.id,
        category: cat,
        cost: target.cost,
        tickNumber: run.tickNumber,
      });
      ap.tier3.lastBoughtTick[target.def.id] = run.tickNumber;
    }
  }
}

/** Tier 3: per-stat priority. Tier 4 rules are applied as overrides on top. */
function evaluateTier3OrHigher(run: RunState): void {
  const ap = run.autoProcurement;

  const policy = resolvePolicy(run);
  if (policy.pause) return;

  // Collect candidates filtered by per-stat reserve-aware affordability.
  // Tier 2 reserves still apply when Tier 3/4 are active, so the player can
  // keep a buffer for manual buys.
  const candidates: Array<{ def: UpgradeDefinition; cost: number; prio: number; last: number }> = [];
  for (const def of listUpgrades()) {
    if (!policy.enabled[def.id]) continue;
    const chan = ap.tier2.channels[def.category];
    // Tier 3+ still honors Tier 2 reserves per spec §7 composition.
    const budget = chan.enabled || ap.activeTier < 3 ? run.scrip - chan.reserve : run.scrip;
    if (budget <= 0) continue;
    const lvl = run.forge.levels[def.id];
    const cost = nextCost(def, lvl);
    if (cost > budget) continue;
    candidates.push({
      def,
      cost,
      prio: policy.priority[def.id],
      last: ap.tier3.lastBoughtTick[def.id] ?? 0,
    });
  }
  if (candidates.length === 0) return;

  candidates.sort((a, b) => {
    if (a.prio !== b.prio) return b.prio - a.prio; // higher priority first
    if (policy.fairnessRoundRobin) {
      if (a.last !== b.last) return a.last - b.last; // least recently bought
    }
    if (a.cost !== b.cost) return a.cost - b.cost; // cheapest next
    return a.def.id < b.def.id ? -1 : 1; // deterministic tiebreak
  });

  const target = candidates[0]!;
  const result = buyUpgrade(run, target.def.id);
  if (result === "bought") {
    pushPulse(ap, {
      upgradeId: target.def.id,
      category: target.def.category,
      cost: target.cost,
      tickNumber: run.tickNumber,
    });
    ap.tier3.lastBoughtTick[target.def.id] = run.tickNumber;
  }
}

/* ================ Tier 4 rules engine ================ */

function resolvePolicy(run: RunState): ResolvedPolicy {
  const ap = run.autoProcurement;
  // Start from the Tier 3 saved configuration.
  const policy: ResolvedPolicy = {
    priority: { ...ap.tier3.priority },
    enabled: { ...ap.tier3.enabled },
    pause: false,
    fairnessRoundRobin: ap.tier3.fairnessRoundRobin,
  };

  if (ap.activeTier < 4) return policy;

  const matches: Rule[] = [];
  for (const rule of ap.tier4.rules) {
    if (!rule.enabled) continue;
    if (!evaluateCondition(run, rule.condition)) continue;
    matches.push(rule);
    if (ap.tier4.mode === "first-match") break;
  }

  for (const rule of matches) {
    for (const action of rule.actions) applyAction(policy, action);
  }

  return policy;
}

function evaluateCondition(run: RunState, cond: RuleCondition): boolean {
  const lhs = readSensor(run, cond.sensor);
  switch (cond.comparator) {
    case "<": return lhs < cond.value;
    case "<=": return lhs <= cond.value;
    case ">": return lhs > cond.value;
    case ">=": return lhs >= cond.value;
    case "==": return lhs === cond.value;
    case "!=": return lhs !== cond.value;
  }
}

function readSensor(run: RunState, sensor: Sensor): number {
  switch (sensor) {
    case "sentinel.hpPercent": {
      const max = run.sentinel.stats.maxHealth || 1;
      return (run.sentinel.stats.health / max) * 100;
    }
    case "cycle":
      return run.cycle;
    case "cycle.isBoss":
      // Boss Cycle = every 10th Cycle per Phase 5 spec.
      return run.cycle > 0 && run.cycle % 10 === 0 ? 1 : 0;
    case "scrip":
      return run.scrip;
    case "enemiesAlive":
      return run.enemies.filter((e) => e.state !== "dying").length;
    case "runDurationSeconds":
      // Deterministic: derived from tick count, independent of wall-clock.
      return run.tickNumber / 60;
  }
}

function applyAction(policy: ResolvedPolicy, action: Action): void {
  switch (action.kind) {
    case "PAUSE_AUTO_BUY":
      policy.pause = true;
      return;
    case "SET_PRIORITY":
      if (policy.priority[action.statId] != null) {
        policy.priority[action.statId] = action.priority;
      }
      return;
    case "DISABLE_CATEGORY":
      for (const def of listUpgradesByCategory(action.category)) {
        policy.enabled[def.id] = false;
      }
      return;
    case "ENABLE_CATEGORY":
      for (const def of listUpgradesByCategory(action.category)) {
        policy.enabled[def.id] = true;
      }
      return;
    case "ONLY_BUY": {
      const wanted = new Set(action.statIds);
      for (const def of listUpgrades()) {
        policy.enabled[def.id] = wanted.has(def.id);
      }
      return;
    }
  }
}

/* ================ Selection helpers ================ */

function pickCheapestAffordableWithin(
  run: RunState,
  category: UpgradeCategory,
  budget: number,
): { def: UpgradeDefinition; cost: number } | null {
  let best: { def: UpgradeDefinition; cost: number } | null = null;
  for (const def of listUpgradesByCategory(category)) {
    const lvl = run.forge.levels[def.id];
    const cost = nextCost(def, lvl);
    if (cost > budget) continue;
    if (!best || cost < best.cost || (cost === best.cost && def.id < best.def.id)) {
      best = { def, cost };
    }
  }
  return best;
}

function pushPulse(ap: AutoProcurementState, pulse: AutoBuyPulse): void {
  ap.pulses.push(pulse);
  if (ap.pulses.length > PULSE_RING_MAX) {
    ap.pulses.splice(0, ap.pulses.length - PULSE_RING_MAX);
  }
}

/* ================ Player-facing actions ================ */

export function setTier1Enabled(run: RunState, enabled: boolean): void {
  run.autoProcurement.tier1.enabled = enabled;
}

export function setTier1Category(run: RunState, category: UpgradeCategory): void {
  run.autoProcurement.tier1.category = category;
  run.autoProcurement.tier1.enabled = true;
}

export function setTier2Channel(
  run: RunState,
  category: UpgradeCategory,
  enabled: boolean,
): void {
  run.autoProcurement.tier2.channels[category].enabled = enabled;
}

export function setTier2Reserve(
  run: RunState,
  category: UpgradeCategory,
  reserve: number,
): void {
  run.autoProcurement.tier2.channels[category].reserve = Math.max(0, Math.floor(reserve));
}

export function setTier3StatEnabled(run: RunState, statId: UpgradeId, enabled: boolean): void {
  run.autoProcurement.tier3.enabled[statId] = enabled;
}

export function setTier3Priority(run: RunState, statId: UpgradeId, priority: number): void {
  run.autoProcurement.tier3.priority[statId] = clamp(Math.round(priority), 1, 10);
}

export function setTier3Fairness(run: RunState, fairness: boolean): void {
  run.autoProcurement.tier3.fairnessRoundRobin = fairness;
}

export function setTier4Mode(run: RunState, mode: "first-match" | "all-match"): void {
  run.autoProcurement.tier4.mode = mode;
}

export function toggleTier4Rule(run: RunState, ruleId: string, enabled: boolean): void {
  const r = run.autoProcurement.tier4.rules.find((x) => x.id === ruleId);
  if (r) r.enabled = enabled;
}

export function addTier4RuleFromTemplate(run: RunState, templateName: string): Rule | null {
  const tpl = RULE_TEMPLATES.find((t) => t.name === templateName);
  if (!tpl) return null;
  const rules = run.autoProcurement.tier4.rules;
  if (rules.length >= 5) return null; // spec §9: up to 5 active rules
  const rule: Rule = {
    id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    name: tpl.name,
    enabled: true,
    condition: { ...tpl.condition },
    actions: tpl.actions.map((a) => ({ ...a })),
  };
  rules.push(rule);
  return rule;
}

export function removeTier4Rule(run: RunState, ruleId: string): void {
  const rules = run.autoProcurement.tier4.rules;
  const ix = rules.findIndex((x) => x.id === ruleId);
  if (ix >= 0) rules.splice(ix, 1);
}

/** Called by the run host when the Research Bay completes an AP tier project. */
export function setUnlockedTier(run: RunState, tier: AutoProcurementTier): void {
  if (tier > run.autoProcurement.unlockedTier) run.autoProcurement.unlockedTier = tier;
  if (tier > run.autoProcurement.activeTier) run.autoProcurement.activeTier = tier;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Keep getUpgrade import used (for future rule UI; referenced by tests too).
void getUpgrade;
