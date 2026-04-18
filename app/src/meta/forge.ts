/**
 * In-run Forge — temporary Sentinel stat upgrades bought with Scrip during a run.
 *
 * Per docs/my_game/01-core-runtime-and-combat-spec.md §6 the catalogue is split into
 * Attack / Defense / Utility tabs. Phase 2 ships the MVP subset listed in
 * docs/my_game/11-build-roadmap.md Phase 2; the full ~37-stat surface lands in later phases.
 *
 * In-run Forge upgrades reset on run end. The meta-level Forge (paid with Alloy,
 * raises baseline stats across runs) is a separate system that lands in Phase 4+.
 */

import type { SentinelStats } from "../sim/types.ts";

export type UpgradeCategory = "attack" | "defense" | "utility";

export type UpgradeId =
  | "damage"
  | "attackSpeed"
  | "range"
  | "health"
  | "defensePercent"
  | "thorns"
  | "lifesteal"
  | "scripBonus"
  | "alloyPerKill";

export type ForgeState = {
  levels: Record<UpgradeId, number>;
};

export type UpgradeDefinition = {
  id: UpgradeId;
  name: string;
  category: UpgradeCategory;
  baseCost: number;
  costMultiplier: number;
  /** Returns the value this upgrade contributes at the given level. Level 0 = no contribution. */
  contribution: (level: number) => number;
  /** Mutates `out` in place: applies this upgrade's contribution. */
  apply: (out: SentinelStats, level: number) => void;
  /** For HUD: render the current → next preview. */
  formatStat: (current: SentinelStats, nextLevel: number) => string;
};

const UPGRADES: UpgradeDefinition[] = [
  // ----- Attack -----
  {
    id: "damage",
    name: "Damage",
    category: "attack",
    baseCost: 10,
    costMultiplier: 1.08,
    contribution: (l) => l * 2,
    apply: (out, l) => { out.damage += l * 2; },
    formatStat: (cur, next) => `${cur.damage.toFixed(0)} → ${(cur.damage + 2).toFixed(0)} · L${next}`,
  },
  {
    id: "attackSpeed",
    name: "Attack Speed",
    category: "attack",
    baseCost: 18,
    costMultiplier: 1.10,
    contribution: (l) => l * 0.15,
    apply: (out, l) => { out.attackSpeed += l * 0.15; },
    formatStat: (cur, next) =>
      `${cur.attackSpeed.toFixed(2)}/s → ${(cur.attackSpeed + 0.15).toFixed(2)}/s · L${next}`,
  },
  {
    id: "range",
    name: "Range",
    category: "attack",
    baseCost: 22,
    costMultiplier: 1.07,
    contribution: (l) => l * 18,
    apply: (out, l) => { out.range += l * 18; },
    formatStat: (cur, next) => `${cur.range.toFixed(0)} → ${(cur.range + 18).toFixed(0)} · L${next}`,
  },

  // ----- Defense -----
  {
    id: "health",
    name: "Health",
    category: "defense",
    baseCost: 14,
    costMultiplier: 1.09,
    contribution: (l) => l * 25,
    apply: (out, l) => {
      out.maxHealth += l * 25;
      // Buying Health also restores by the increment so the new max is usable immediately.
    },
    formatStat: (cur, next) => `${cur.maxHealth.toFixed(0)} → ${(cur.maxHealth + 25).toFixed(0)} · L${next}`,
  },
  {
    id: "defensePercent",
    name: "Defense %",
    category: "defense",
    baseCost: 30,
    costMultiplier: 1.12,
    contribution: (l) => Math.min(0.75, l * 0.02), // soft-cap at 75%
    apply: (out, l) => {
      // Phase 2: stored on the stats object for future damage pipeline; not yet
      // consumed by sentinel/defense.ts (Phase 5 wires the full incoming-hit pipeline).
      const cur = out.defensePercent ?? 0;
      out.defensePercent = Math.min(0.75, cur + l * 0.02);
    },
    formatStat: (cur, next) => {
      const pct = Math.min(75, Math.round((cur.defensePercent ?? 0) * 100));
      const nextPct = Math.min(75, pct + 2);
      return `${pct}% → ${nextPct}% · L${next}`;
    },
  },
  {
    id: "thorns",
    name: "Thorns",
    category: "defense",
    baseCost: 18,
    costMultiplier: 1.10,
    contribution: (l) => l * 3,
    apply: (out, l) => { out.thorns = (out.thorns ?? 0) + l * 3; },
    formatStat: (cur, next) => {
      const t = cur.thorns ?? 0;
      return `${t.toFixed(0)} → ${(t + 3).toFixed(0)} · L${next}`;
    },
  },
  {
    id: "lifesteal",
    name: "Lifesteal",
    category: "defense",
    baseCost: 26,
    costMultiplier: 1.12,
    contribution: (l) => Math.min(0.5, l * 0.015),
    apply: (out, l) => {
      out.lifesteal = Math.min(0.5, (out.lifesteal ?? 0) + l * 0.015);
    },
    formatStat: (cur, next) => {
      const ls = Math.round((cur.lifesteal ?? 0) * 1000) / 10;
      const nextLs = Math.min(50, ls + 1.5);
      return `${ls.toFixed(1)}% → ${nextLs.toFixed(1)}% · L${next}`;
    },
  },

  // ----- Utility -----
  {
    id: "scripBonus",
    name: "Scrip Bonus",
    category: "utility",
    baseCost: 50,
    costMultiplier: 1.18,
    contribution: (l) => l * 0.10,
    apply: (out, l) => { out.scripBonus = (out.scripBonus ?? 0) + l * 0.10; },
    formatStat: (cur, next) => {
      const b = Math.round((cur.scripBonus ?? 0) * 100);
      return `+${b}% → +${b + 10}% · L${next}`;
    },
  },
  {
    id: "alloyPerKill",
    name: "Alloy/Kill",
    category: "utility",
    baseCost: 40,
    costMultiplier: 1.15,
    contribution: (l) => l * 1,
    apply: (out, l) => { out.alloyPerKill = (out.alloyPerKill ?? 0) + l; },
    formatStat: (cur, next) => {
      const a = cur.alloyPerKill ?? 0;
      return `+${a} → +${a + 1} · L${next}`;
    },
  },
];

export function listUpgrades(): ReadonlyArray<UpgradeDefinition> {
  return UPGRADES;
}

export function getUpgrade(id: UpgradeId): UpgradeDefinition {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) throw new Error(`Unknown upgrade: ${id}`);
  return def;
}

export function listUpgradesByCategory(cat: UpgradeCategory): ReadonlyArray<UpgradeDefinition> {
  return UPGRADES.filter((u) => u.category === cat);
}

export function createForgeState(): ForgeState {
  const levels = {} as Record<UpgradeId, number>;
  for (const u of UPGRADES) levels[u.id] = 0;
  return { levels };
}

export function nextCost(def: UpgradeDefinition, currentLevel: number): number {
  return Math.ceil(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}

/**
 * Recomputes derived Sentinel stats by starting from the base and applying every
 * Forge upgrade's contribution. Health is preserved (current HP doesn't reset),
 * but a maxHealth increase heals by the diff.
 *
 * Phase 10: optional `preLayer` callback lets the caller layer Protocol +
 * Augment contributions **on top of base** (so Forge percentages compound on
 * the buffed baseline rather than raw base).
 */
export function applyForge(
  base: SentinelStats,
  forge: ForgeState,
  out: SentinelStats,
  preLayer?: (s: SentinelStats) => void,
): void {
  const previousMax = out.maxHealth;
  const previousCurrent = out.health;
  Object.assign(out, base);
  if (preLayer) preLayer(out);
  for (const def of UPGRADES) {
    const lvl = forge.levels[def.id];
    if (lvl > 0) def.apply(out, lvl);
  }
  const maxDelta = out.maxHealth - previousMax;
  if (maxDelta > 0) {
    out.health = Math.min(out.maxHealth, previousCurrent + maxDelta);
  } else {
    out.health = Math.min(out.maxHealth, previousCurrent);
  }
}
