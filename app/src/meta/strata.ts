/**
 * Strata — difficulty bands + content gates.
 *
 * Per docs/my_game/04-progression-systems.md §3: 18 Strata at launch, room to
 * extend to 30. Each Stratum is a fixed cycle-scaling + modifier profile.
 * Daily/weekly modifiers on top of each Stratum land in Phase 12 (economy).
 */

export type StratumId = number; // 1..18

export type StratumModifier = {
  id: string;
  label: string;
  description: string;
};

export type StratumDef = {
  id: StratumId;
  name: string;
  flavor: string;
  /** Multiplier applied to enemy HP/damage on top of per-Cycle scaling. */
  baseScale: number;
  /** If true, the Stratum is locked until the player's max-reached catches up. */
  unlockCycle: number; // required highestCycle on the previous Stratum to unlock
  recommended: boolean;
  modifiers: StratumModifier[];
};

/**
 * Strata catalogue. Phase 7 ships 18 with escalating scaling. Names + flavor
 * are placeholders tuned for the sci-fi sentinel theme; fine-tune in polish.
 */
export const STRATA: StratumDef[] = [
  { id: 1,  name: "Outer Sweep",      flavor: "first orbital drift",          baseScale: 1.00, unlockCycle: 0,   recommended: true,  modifiers: [] },
  { id: 2,  name: "Near Shore",       flavor: "contact skim",                  baseScale: 1.35, unlockCycle: 100, recommended: false, modifiers: [] },
  { id: 3,  name: "Silent Cycle",     flavor: "interference pocket",           baseScale: 1.80, unlockCycle: 200, recommended: false, modifiers: [{ id: "no-ap-toasts", label: "Silent Feed", description: "No Auto-Procurement toasts render this run." }] },
  { id: 4,  name: "Scatter Band",     flavor: "distributed pressure",          baseScale: 2.40, unlockCycle: 300, recommended: false, modifiers: [] },
  { id: 5,  name: "Crush Depth",      flavor: "mass attrition",                baseScale: 3.20, unlockCycle: 350, recommended: false, modifiers: [{ id: "hulk-heavy", label: "Hulk Bloom", description: "Hulk spawn weight doubled." }] },
  { id: 6,  name: "Blade Field",      flavor: "skimmer saturation",            baseScale: 4.20, unlockCycle: 400, recommended: false, modifiers: [{ id: "skimmer-heavy", label: "Blade Wind", description: "Skimmers +25% speed." }] },
  { id: 7,  name: "Lance Array",      flavor: "ranged lattice",                baseScale: 5.50, unlockCycle: 450, recommended: false, modifiers: [{ id: "lancer-heavy", label: "Lance Array", description: "Lancer spawn weight +50%. Lancer cooldown −15%." }] },
  { id: 8,  name: "Drift Breach",     flavor: "the first real wall",           baseScale: 7.20, unlockCycle: 500, recommended: false, modifiers: [] },
  { id: 9,  name: "Ember Grid",       flavor: "sustained pressure",            baseScale: 9.50, unlockCycle: 600, recommended: false, modifiers: [{ id: "amplified-rend", label: "Amplified Rend", description: "Rend stacks +50% on contact." }] },
  { id: 10, name: "Hollow Gate",      flavor: "first Behemoth climb",          baseScale: 12.5, unlockCycle: 700, recommended: false, modifiers: [] },
  { id: 11, name: "Bleed Horizon",    flavor: "attrition spiral",              baseScale: 16.3, unlockCycle: 800, recommended: false, modifiers: [] },
  { id: 12, name: "Rift Edge",        flavor: "geometry breaks",               baseScale: 21.5, unlockCycle: 900, recommended: false, modifiers: [] },
  { id: 13, name: "Null Crown",       flavor: "control loss",                  baseScale: 28.0, unlockCycle: 1000, recommended: false, modifiers: [] },
  { id: 14, name: "Fleet Sortie",     flavor: "first fleet contact",           baseScale: 37.0, unlockCycle: 1100, recommended: false, modifiers: [{ id: "fleet-onset", label: "Fleet Onset", description: "Fleet archetypes begin appearing. Phase 14 ships the roster." }] },
  { id: 15, name: "Ash Perimeter",    flavor: "compound hazard",               baseScale: 49.0, unlockCycle: 1250, recommended: false, modifiers: [] },
  { id: 16, name: "Veil Lock",        flavor: "shield saturation",             baseScale: 65.0, unlockCycle: 1400, recommended: false, modifiers: [] },
  { id: 17, name: "Apex Run",         flavor: "near-ceiling clear",            baseScale: 86.0, unlockCycle: 1600, recommended: false, modifiers: [] },
  { id: 18, name: "Ascent",           flavor: "beyond the index",              baseScale: 115.0, unlockCycle: 1800, recommended: false, modifiers: [] },
];

const BY_ID = Object.fromEntries(STRATA.map((s) => [s.id, s]));

export function getStratum(id: StratumId): StratumDef {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown Stratum: ${id}`);
  return def;
}

export function isStratumUnlocked(id: StratumId, highestCycleReached: number): boolean {
  const def = getStratum(id);
  return highestCycleReached >= def.unlockCycle;
}

/** The highest Stratum the player has unlocked based on their best Cycle so far. */
export function maxUnlockedStratum(highestCycleReached: number): StratumId {
  let max: StratumId = 1;
  for (const s of STRATA) {
    if (highestCycleReached >= s.unlockCycle) max = s.id;
  }
  return max;
}
