/**
 * The Order — single-player faction system.
 *
 * Spec: docs/my_game/04-progression-systems.md §12.
 *
 * Phase 13 ships:
 *   - Weekly contribution tracker (Cycles cleared this week → tier rewards)
 *   - Order Marks currency (per-week earn cap = 150)
 *   - Seasonal tracker (8 weeks per season; end-of-season auto-converts leftover Marks → Prisms 5:1)
 *   - 4-tier weekly chest ladder per the spec sample table
 *   - Order Shop with 6 launch items (priced in Order Marks)
 *
 * Unlock gate (Stratum 3, Cycle 10) is enforced at the UI; the data layer always
 * runs so contribution accumulates the moment the player hits the gate.
 */

import type { CurrencyState } from "../save/schema.ts";

export const SEASON_LENGTH_WEEKS = 8;
export const MARK_TO_PRISM_RATE = 5; // 5 Order Marks → 1 Prism on season conversion

/** Weekly chest tiers per spec §12. */
export const WEEKLY_TIERS: ReadonlyArray<{
  threshold: number;
  marks: number;
  subnodes: number;
  alloyMult: number;
  prisms: number;
}> = [
  { threshold: 100, marks: 10, subnodes: 10, alloyMult: 1, prisms: 5 },
  { threshold: 250, marks: 20, subnodes: 25, alloyMult: 2, prisms: 10 },
  { threshold: 500, marks: 40, subnodes: 50, alloyMult: 3, prisms: 15 },
  { threshold: 750, marks: 80, subnodes: 100, alloyMult: 5, prisms: 30 },
];

export type OrderShopItemId =
  | "prisms-small"
  | "prisms-large"
  | "subnodes-pack"
  | "subroutine-bounty"
  | "subroutine-fetch"
  | "heirloom-aether";

export type OrderShopItem = {
  id: OrderShopItemId;
  name: string;
  cost: number;
  desc: string;
  /** What the item grants when bought. */
  grant: (currencies: CurrencyState) => void;
  /** Optional gating — limits per season. Default: 1. */
  perSeasonCap?: number;
};

const SHOP_ITEMS: OrderShopItem[] = [
  {
    id: "prisms-small",
    name: "Prism Cache · 50",
    cost: 15,
    desc: "Adds 50 Prisms to your reserve.",
    grant: (c) => { c.prisms += 50; },
    perSeasonCap: 3,
  },
  {
    id: "prisms-large",
    name: "Prism Cache · 200",
    cost: 50,
    desc: "Adds 200 Prisms to your reserve.",
    grant: (c) => { c.prisms += 200; },
    perSeasonCap: 2,
  },
  {
    id: "subnodes-pack",
    name: "Subnode Pack · 100",
    cost: 25,
    desc: "Adds 100 Subnodes (Warden currency).",
    grant: (c) => { c.subnodes += 100; },
    perSeasonCap: 3,
  },
  {
    id: "subroutine-bounty",
    name: "Subroutine: Bounty",
    cost: 200,
    desc: "Unlock Bounty Subroutine for the Warden.",
    grant: () => { /* handled by host */ },
    perSeasonCap: 1,
  },
  {
    id: "subroutine-fetch",
    name: "Subroutine: Fetch",
    cost: 200,
    desc: "Unlock Fetch Subroutine for the Warden.",
    grant: () => { /* handled by host */ },
    perSeasonCap: 1,
  },
  {
    id: "heirloom-aether",
    name: "Heirloom: Aether Lattice",
    cost: 150,
    desc: "Grant the Aether Lattice Heirloom.",
    grant: () => { /* handled by host */ },
    perSeasonCap: 1,
  },
];

export function listShopItems(): ReadonlyArray<OrderShopItem> {
  return SHOP_ITEMS;
}

export function getShopItem(id: OrderShopItemId): OrderShopItem {
  const it = SHOP_ITEMS.find((x) => x.id === id);
  if (!it) throw new Error(`Unknown shop item: ${id}`);
  return it;
}

export type OrderState = {
  /** Player's joined Order (cosmetic). Defaults to "vanguard". */
  faction: "vanguard" | "ironwake" | "lighthouse";
  /** Cycle-completion contribution this week. */
  weeklyContribution: number;
  /** Highest tier already claimed this week (-1 = nothing claimed yet). */
  weeklyClaimedTier: number;
  /** Week number (ISO) the contribution was last reset for. */
  weekNumberAnchor: number;
  /** Current season (1..). */
  season: number;
  /** ISO week the season started on. */
  seasonStartWeek: number;
  /** Per-season shop purchase counts. */
  seasonPurchases: Partial<Record<OrderShopItemId, number>>;
};

export function createOrderState(): OrderState {
  const week = isoWeek(new Date());
  return {
    faction: "vanguard",
    weeklyContribution: 0,
    weeklyClaimedTier: -1,
    weekNumberAnchor: week,
    season: 1,
    seasonStartWeek: week,
    seasonPurchases: {},
  };
}

/** Year × 100 + ISO week, e.g. 202518. Stable across DST + sessions. */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return date.getUTCFullYear() * 100 + week;
}

/**
 * Roll the Order state forward to the current week. Resets weekly state and
 * advances the season if 8 weeks have elapsed (auto-converting leftover Marks).
 */
export function rolloverWeek(
  state: OrderState,
  currencies: CurrencyState,
  now: Date = new Date(),
): { weeksElapsed: number; seasonEnded: boolean; convertedPrisms: number } {
  const week = isoWeek(now);
  const weeksElapsed = Math.max(0, week - state.weekNumberAnchor);
  if (weeksElapsed === 0) {
    return { weeksElapsed: 0, seasonEnded: false, convertedPrisms: 0 };
  }
  state.weekNumberAnchor = week;
  state.weeklyContribution = 0;
  state.weeklyClaimedTier = -1;

  const weeksIntoSeason = week - state.seasonStartWeek;
  let convertedPrisms = 0;
  let seasonEnded = false;
  if (weeksIntoSeason >= SEASON_LENGTH_WEEKS) {
    seasonEnded = true;
    convertedPrisms = Math.ceil(currencies.orderMarks / MARK_TO_PRISM_RATE);
    currencies.prisms += convertedPrisms;
    currencies.orderMarks = 0;
    state.season += 1;
    state.seasonStartWeek = week;
    state.seasonPurchases = {};
  }
  return { weeksElapsed, seasonEnded, convertedPrisms };
}

export function recordContribution(state: OrderState, cyclesContributed: number): void {
  state.weeklyContribution = Math.max(0, state.weeklyContribution + cyclesContributed);
}

export function claimableTier(state: OrderState): number {
  for (let t = WEEKLY_TIERS.length - 1; t >= 0; t--) {
    if (state.weeklyContribution >= WEEKLY_TIERS[t]!.threshold && state.weeklyClaimedTier < t) {
      return t;
    }
  }
  return -1;
}

export function claimWeeklyTier(
  state: OrderState,
  currencies: CurrencyState,
  tier: number,
): "claimed" | "not-eligible" | "already-claimed" {
  if (tier < 0 || tier >= WEEKLY_TIERS.length) return "not-eligible";
  if (state.weeklyClaimedTier >= tier) return "already-claimed";
  const def = WEEKLY_TIERS[tier]!;
  if (state.weeklyContribution < def.threshold) return "not-eligible";
  state.weeklyClaimedTier = tier;
  currencies.orderMarks += def.marks;
  currencies.subnodes += def.subnodes;
  currencies.prisms += def.prisms;
  // Alloy multiplier is a meta hint for the next run; not granted as currency directly.
  return "claimed";
}

export type ShopBuyResult =
  | { ok: true; itemId: OrderShopItemId }
  | { ok: false; reason: "unaffordable" | "season-cap" };

export function buyShopItem(
  state: OrderState,
  currencies: CurrencyState,
  itemId: OrderShopItemId,
): ShopBuyResult {
  const item = getShopItem(itemId);
  const cap = item.perSeasonCap ?? 1;
  const purchased = state.seasonPurchases[itemId] ?? 0;
  if (purchased >= cap) return { ok: false, reason: "season-cap" };
  if (currencies.orderMarks < item.cost) return { ok: false, reason: "unaffordable" };
  currencies.orderMarks -= item.cost;
  state.seasonPurchases[itemId] = purchased + 1;
  item.grant(currencies);
  return { ok: true, itemId };
}
