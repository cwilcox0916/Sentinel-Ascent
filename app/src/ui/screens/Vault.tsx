/**
 * Vault overlay — Daily Drop + Achievement Vault in one screen.
 *
 * Spec: docs/my_game/05-currencies-and-economy.md §4 (Daily Drop) + §15 (Achievements).
 *
 * Accessed from the Hangar header. Esc closes. Claim buttons mutate slot state
 * and trigger an immediate save commit.
 */

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../store/appStore.ts";
import { useSaveStore } from "../../store/saveStore.ts";
import {
  claimDailyDrop,
  getDailyDropStatus,
  DAILY_DROP_STREAK_CAP,
} from "../../econ/dailyDrop.ts";
import {
  claimAchievement,
  getAchievement,
  listAchievements,
  type AchievementId,
} from "../../econ/achievements.ts";
import { writeSlot } from "../../save/repository.ts";
import {
  buyShopItem,
  claimWeeklyTier,
  claimableTier,
  listShopItems,
  WEEKLY_TIERS,
} from "../../econ/order.ts";
import {
  cipherKeysForCycle,
  currentWeekRecord,
  weeklyTrialSeed,
} from "../../econ/weeklyTrial.ts";
import {
  equipSubroutine,
  isWardenUnlockEligible,
  levelUpSubroutine,
  listSubroutines,
  SLOT_UNLOCK_COSTS,
  SUBROUTINE_LEVEL_COST_BASE,
  SUBROUTINE_MAX_LEVEL,
  unlockNextSlot,
  unlockWarden,
  grantSubroutine,
  type SubroutineId,
} from "../../meta/warden.ts";
import {
  ARCHIVE_BRANCHES,
  isNodeAvailable,
  listArchiveNodes,
  purchaseArchiveNode,
} from "../../meta/archive.ts";

type Tab = "daily" | "achievements" | "order" | "warden" | "trials" | "archive";

export function VaultHost({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return <Vault onClose={onClose} />;
}

function Vault({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("daily");
  const slot = useAppStore((s) => s.activeSlot);
  const setSlot = useAppStore((s) => s.setActiveSlot);
  const flash = useSaveStore((s) => s.flash);
  const [, force] = useState(0);

  if (!slot) return null;

  const commit = (): void => {
    void writeSlot(slot).then(() => flash());
    setSlot(slot); // re-publish reference so Zustand selectors refire
    force((n) => n + 1);
  };

  return (
    <div className="screen open" id="vault-screen">
      <div className="screen-head">
        <div className="crumbs">
          <span className="parent">Hangar</span>
          <span className="sep">·</span>
          <span className="name">Vault</span>
        </div>
        <div className="chips-mini" style={{ marginLeft: "auto" }}>
          <div className="chip-mini" style={{ ["--chip" as never]: "var(--prism)" }}>
            <span className="lbl">Prisms</span>
            <span className="val mono">{slot.currencies.prisms}</span>
          </div>
          <button className="pill" onClick={onClose}>✕ Close · Esc</button>
        </div>
      </div>

      <div className="loadout-tabs">
        <button
          className={`loadout-tab${tab === "daily" ? " active" : ""}`}
          onClick={() => setTab("daily")}
        >
          Daily Drop
        </button>
        <button
          className={`loadout-tab${tab === "achievements" ? " active" : ""}`}
          onClick={() => setTab("achievements")}
        >
          Achievements
        </button>
        <button
          className={`loadout-tab${tab === "order" ? " active" : ""}`}
          onClick={() => setTab("order")}
        >
          The Order
        </button>
        <button
          className={`loadout-tab${tab === "warden" ? " active" : ""}`}
          onClick={() => setTab("warden")}
        >
          Warden
        </button>
        <button
          className={`loadout-tab${tab === "trials" ? " active" : ""}`}
          onClick={() => setTab("trials")}
        >
          Weekly Trial
        </button>
        <button
          className={`loadout-tab${tab === "archive" ? " active" : ""}`}
          onClick={() => setTab("archive")}
        >
          Archive
        </button>
      </div>

      <div className="screen-body loadout-body">
        {tab === "daily" && <DailyDropTab commit={commit} />}
        {tab === "achievements" && <AchievementsTab commit={commit} />}
        {tab === "order" && <OrderTab commit={commit} />}
        {tab === "warden" && <WardenTab commit={commit} />}
        {tab === "trials" && <TrialsTab />}
        {tab === "archive" && <ArchiveTab commit={commit} />}
      </div>
    </div>
  );
}

function DailyDropTab({ commit }: { commit: () => void }) {
  const slot = useAppStore((s) => s.activeSlot)!;
  const now = Date.now();
  const status = useMemo(() => getDailyDropStatus(slot.dailyDrop, now), [slot.dailyDrop, now]);
  const readyPayout = status.ready ? status.payout : null;

  const onClaim = (): void => {
    const result = claimDailyDrop(slot.dailyDrop, slot.currencies, Date.now());
    if (result.ok) commit();
  };

  return (
    <div className="vault-daily">
      <div className="vault-card">
        <div className="vault-card-head mono">DAILY DROP</div>
        <div className="vault-daily-hero">
          <div className="vault-daily-payout mono">
            +{readyPayout ?? `${getPayoutForStreak(slot.dailyDrop.streak)}P`}
          </div>
          <div className="vault-daily-sub mono">
            {status.ready
              ? `Streak day ${status.nextStreak} of ${DAILY_DROP_STREAK_CAP}`
              : `Ready in ${formatDuration((status as { readyInMs: number }).readyInMs)}`}
          </div>
          <button
            className="df-cta primary"
            onClick={onClaim}
            disabled={!status.ready}
            style={{ marginTop: 18 }}
          >
            {status.ready ? "CLAIM" : "WAITING"}
          </button>
        </div>
        <div className="vault-streak-ladder">
          {Array.from({ length: DAILY_DROP_STREAK_CAP }, (_, i) => {
            const day = i + 1;
            const cur = slot.dailyDrop.streak;
            return (
              <div
                key={day}
                className={`vault-streak-rung${cur >= day ? " done" : ""}${cur + 1 === day && status.ready ? " next" : ""}`}
              >
                <div className="vault-streak-day mono">D{day}</div>
                <div className="vault-streak-p mono">+{day >= DAILY_DROP_STREAK_CAP ? 100 : 30 + (day - 1) * 10}P</div>
              </div>
            );
          })}
        </div>
        <div className="vault-daily-lifetime mono">
          Lifetime Prisms from Daily Drop: {slot.dailyDrop.lifetimeClaimed}
        </div>
      </div>
    </div>
  );
}

function getPayoutForStreak(streak: number): number {
  const s = Math.max(1, Math.min(DAILY_DROP_STREAK_CAP, streak + 1));
  return 30 + (s - 1) * 10;
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function AchievementsTab({ commit }: { commit: () => void }) {
  const slot = useAppStore((s) => s.activeSlot)!;
  const entries = listAchievements();
  const unlockedCount = entries.filter((a) => slot.achievements.unlocked[a.id]).length;
  const claimedCount = entries.filter((a) => slot.achievements.claimed[a.id]).length;
  const unclaimed = entries.filter(
    (a) => slot.achievements.unlocked[a.id] && !slot.achievements.claimed[a.id],
  );

  const claimAll = (): void => {
    for (const a of unclaimed) claimAchievement(slot.achievements, slot.currencies, a.id);
    commit();
  };

  return (
    <div className="vault-achievements">
      <div className="vault-stats-row">
        <div className="vault-stat mono">
          <span className="lbl">UNLOCKED</span>
          <span className="val">{unlockedCount}/{entries.length}</span>
        </div>
        <div className="vault-stat mono">
          <span className="lbl">CLAIMED</span>
          <span className="val">{claimedCount}/{entries.length}</span>
        </div>
        <button
          className="df-cta primary"
          disabled={unclaimed.length === 0}
          onClick={claimAll}
        >
          CLAIM ALL · +{unclaimed.reduce((a, b) => a + b.reward, 0)}P
        </button>
      </div>
      <div className="vault-ach-grid">
        {entries.map((a) => {
          const unlocked = slot.achievements.unlocked[a.id];
          const claimed = slot.achievements.claimed[a.id];
          return (
            <div
              key={a.id}
              className={`vault-ach${unlocked ? " unlocked" : " locked"}${claimed ? " claimed" : ""}`}
            >
              <div className="vault-ach-head">
                <div className="vault-ach-name">{a.name}</div>
                <div className="vault-ach-reward mono">+{a.reward}P</div>
              </div>
              <div className="vault-ach-desc mono">{a.description}</div>
              <div className="vault-ach-status mono">
                {claimed ? "CLAIMED" : unlocked ? "READY TO CLAIM" : "LOCKED"}
              </div>
              {unlocked && !claimed && (
                <button
                  className="lo-btn primary"
                  onClick={() => {
                    claimAchievement(slot.achievements, slot.currencies, a.id as AchievementId);
                    commit();
                  }}
                  style={{ marginTop: 6 }}
                >
                  CLAIM · +{a.reward}P
                </button>
              )}
            </div>
          );
        })}
      </div>
      {/* Silence unused-var warning on commit helper when we don't have any unlocked achievements */}
      <span style={{ display: "none" }}>{String(!!getAchievement)}</span>
    </div>
  );
}

/* ================ Order tab ================ */

function OrderTab({ commit }: { commit: () => void }) {
  const slot = useAppStore((s) => s.activeSlot)!;
  const order = slot.order;
  const topTier = claimableTier(order);

  const onClaim = (tier: number): void => {
    if (claimWeeklyTier(order, slot.currencies, tier) === "claimed") commit();
  };

  const onShop = (id: Parameters<typeof buyShopItem>[2]): void => {
    const result = buyShopItem(order, slot.currencies, id);
    if (!result.ok) return;
    if (id === "subroutine-bounty") grantSubroutine(slot.warden, "bounty");
    if (id === "subroutine-fetch") grantSubroutine(slot.warden, "fetch");
    if (id === "heirloom-aether") slot.heirlooms.owned["aether-lattice"] = true;
    commit();
  };

  return (
    <div className="order-tab">
      <div className="order-header">
        <div className="order-season mono">SEASON {order.season} · WEEK · {order.weekNumberAnchor}</div>
        <div className="order-marks mono">
          <span className="lbl">MARKS</span>
          <span className="val">{slot.currencies.orderMarks}</span>
        </div>
      </div>

      <div className="lo-section-head mono">Weekly Contribution · {order.weeklyContribution} Cycles</div>
      <div className="order-ladder">
        {WEEKLY_TIERS.map((tier, i) => {
          const met = order.weeklyContribution >= tier.threshold;
          const claimed = order.weeklyClaimedTier >= i;
          const isClaimable = i === topTier;
          return (
            <div
              key={i}
              className={`order-tier${met ? " met" : ""}${claimed ? " claimed" : ""}${isClaimable ? " claimable" : ""}`}
            >
              <div className="order-tier-head mono">TIER {i + 1} · &ge;{tier.threshold}</div>
              <div className="order-tier-reward mono">
                +{tier.marks}M · +{tier.subnodes}S · +{tier.prisms}P · {tier.alloyMult}x Alloy
              </div>
              {isClaimable ? (
                <button className="lo-btn primary" onClick={() => onClaim(i)}>CLAIM</button>
              ) : claimed ? (
                <div className="order-tier-status mono">CLAIMED</div>
              ) : (
                <div className="order-tier-status mono">{met ? "READY" : "LOCKED"}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="lo-section-head mono">Order Shop</div>
      <div className="lo-items">
        {listShopItems().map((item) => {
          const cap = item.perSeasonCap ?? 1;
          const bought = order.seasonPurchases[item.id] ?? 0;
          const soldOut = bought >= cap;
          const affordable = slot.currencies.orderMarks >= item.cost;
          return (
            <div key={item.id} className={`lo-item${soldOut ? " claimed" : affordable ? " owned" : ""}`}>
              <div className="lo-item-head">
                <div className="lo-item-name">{item.name}</div>
                <div className="lo-item-lvl mono">{item.cost}M · {bought}/{cap}</div>
              </div>
              <div className="lo-item-desc mono">{item.desc}</div>
              <div className="lo-item-actions">
                <button
                  className="lo-btn primary"
                  onClick={() => onShop(item.id)}
                  disabled={soldOut || !affordable}
                >
                  {soldOut ? "SOLD OUT" : `BUY · ${item.cost}M`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================ Warden tab ================ */

function WardenTab({ commit }: { commit: () => void }) {
  const slot = useAppStore((s) => s.activeSlot)!;
  const warden = slot.warden;
  const eligible = isWardenUnlockEligible(slot.metadata.highestCycle, maxStratumReached(slot));

  if (!warden.unlocked) {
    return (
      <div className="warden-tab">
        <div className="vault-card">
          <div className="vault-card-head mono">WARDEN &middot; LOCKED</div>
          <div className="mono" style={{ color: "var(--fg-dim)", lineHeight: 1.6 }}>
            {eligible
              ? "Pay 100 Subnodes to deploy the Warden and receive the Strike Subroutine."
              : "Reach Stratum 3 / Cycle 100 to qualify for Warden deployment."}
          </div>
          <div className="mono" style={{ color: "var(--fg-mute)" }}>
            Subnodes: {slot.currencies.subnodes}
          </div>
          <button
            className="df-cta primary"
            disabled={!eligible || slot.currencies.subnodes < SLOT_UNLOCK_COSTS[0]!}
            onClick={() => { unlockWarden(warden, slot.currencies); commit(); }}
            style={{ alignSelf: "flex-start" }}
          >
            DEPLOY WARDEN &middot; 100 SUBNODES
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="warden-tab">
      <div className="vault-card">
        <div className="vault-card-head mono">WARDEN &middot; ONLINE</div>
        <div className="warden-slots">
          {warden.equipped.map((id, ix) => {
            const unlocked = ix < warden.unlockedSlots;
            const def = id ? listSubroutines().find((s) => s.id === id) : null;
            return (
              <div key={ix} className={`lo-slot-card${id ? " filled" : " empty"}${unlocked ? "" : " locked"}`}>
                <div className="lo-slot-head mono">SLOT {ix + 1}</div>
                {unlocked && def ? (
                  <>
                    <div className="lo-slot-name">{def.name}</div>
                    <div className="lo-slot-effect mono">{def.formatEffect(warden.levels[def.id])}</div>
                    <button className="lo-slot-unequip" onClick={() => { equipSubroutine(warden, ix, null); commit(); }}>
                      UNEQUIP
                    </button>
                  </>
                ) : unlocked ? (
                  <div className="lo-slot-empty mono">Pick a Subroutine below</div>
                ) : (
                  <>
                    <div className="lo-slot-empty mono">Locked &mdash; {SLOT_UNLOCK_COSTS[ix]} Subnodes</div>
                    <button
                      className="lo-slot-unequip"
                      disabled={slot.currencies.subnodes < SLOT_UNLOCK_COSTS[ix]!}
                      onClick={() => { unlockNextSlot(warden, slot.currencies); commit(); }}
                    >
                      UNLOCK
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="lo-section-head mono">Subroutines</div>
      <div className="lo-items">
        {listSubroutines().map((def) => {
          const owned = warden.owned[def.id];
          const lvl = warden.levels[def.id];
          const equippedIx = warden.equipped.findIndex((e) => e === def.id);
          const costNext = SUBROUTINE_LEVEL_COST_BASE * Math.pow(2, lvl);
          return (
            <div key={def.id} className={`lo-item${owned ? " owned" : ""}${equippedIx >= 0 ? " equipped" : ""}`}>
              <div className="lo-item-head">
                <div className="lo-item-name">{def.name}</div>
                <div className="lo-item-lvl mono">{owned ? `L${lvl} / ${SUBROUTINE_MAX_LEVEL}` : "NOT OWNED"}</div>
              </div>
              <div className="lo-item-desc mono">{def.description}</div>
              <div className="lo-item-effect mono">{def.formatEffect(Math.max(1, lvl))}</div>
              <div className="lo-item-actions">
                {!owned && (
                  <button className="lo-btn" disabled title="Earn from the Order Shop">LOCKED</button>
                )}
                {owned && lvl < SUBROUTINE_MAX_LEVEL && (
                  <button
                    className="lo-btn primary"
                    onClick={() => { levelUpSubroutine(warden, slot.currencies, def.id as SubroutineId); commit(); }}
                    disabled={slot.currencies.subnodes < costNext}
                  >
                    LEVEL UP &middot; {costNext} SUB
                  </button>
                )}
                {owned && (
                  <button
                    className="lo-btn"
                    onClick={() => {
                      const emptyIx = warden.equipped.findIndex((e, i) => !e && i < warden.unlockedSlots);
                      const targetIx = equippedIx >= 0 ? equippedIx : (emptyIx >= 0 ? emptyIx : 0);
                      equipSubroutine(warden, targetIx, equippedIx >= 0 ? null : (def.id as SubroutineId));
                      commit();
                    }}
                  >
                    {equippedIx >= 0 ? "UNEQUIP" : "EQUIP"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function maxStratumReached(slot: ReturnType<typeof useAppStore.getState>["activeSlot"]): number {
  const cycleBased = slot?.metadata.highestCycle ?? 0;
  if (cycleBased >= 200) return 3;
  return slot?.selectedStratum ?? 1;
}

/* ================ Trials tab ================ */

function TrialsTab() {
  const slot = useAppStore((s) => s.activeSlot)!;
  const rec = currentWeekRecord(slot.weeklyTrial);
  const seed = weeklyTrialSeed();
  const bracket = rec ? cipherKeysForCycle(rec.bestCycle) : 0;

  return (
    <div className="trials-tab">
      <div className="vault-card">
        <div className="vault-card-head mono">WEEKLY TRIAL</div>
        <div className="trials-row">
          <div className="trials-stat mono">
            <span className="lbl">WEEK SEED</span>
            <span className="val">{seed.toString(16).slice(0, 12).toUpperCase()}</span>
          </div>
          <div className="trials-stat mono">
            <span className="lbl">BEST CYCLE</span>
            <span className="val">{rec?.bestCycle ?? 0}</span>
          </div>
          <div className="trials-stat mono">
            <span className="lbl">ATTEMPTS</span>
            <span className="val">{rec?.attempts ?? 0}</span>
          </div>
          <div className="trials-stat mono">
            <span className="lbl">CIPHER</span>
            <span className="val">{rec?.cipherKeysAwarded ?? 0}</span>
          </div>
        </div>
        <div className="mono" style={{ color: "var(--fg-dim)", fontSize: 11, letterSpacing: "0.1em" }}>
          Every completed run contributes to this week&apos;s Trial. Reach Cycle 25/50/100/200 for 1/2/3/5 Cipher Keys.
        </div>
      </div>
      <div className="lo-section-head mono">Cipher Key Bracket</div>
      <div className="trials-brackets">
        {[{c: 25, k: 1}, {c: 50, k: 2}, {c: 100, k: 3}, {c: 200, k: 5}].map(({c, k}) => (
          <div key={c} className={`trials-bracket${rec && rec.bestCycle >= c ? " met" : ""}${bracket >= k ? " claimed" : ""}`}>
            <div className="trials-bracket-cycle mono">CYCLE {c}</div>
            <div className="trials-bracket-reward mono">+{k} CIPHER</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================ Archive tab ================ */

function ArchiveTab({ commit }: { commit: () => void }) {
  const slot = useAppStore((s) => s.activeSlot)!;
  const archive = slot.archive;
  const nodes = listArchiveNodes();

  const onBuy = (nodeId: Parameters<typeof purchaseArchiveNode>[1]): void => {
    const result = purchaseArchiveNode(slot, nodeId);
    if (result === "bought") commit();
  };

  return (
    <div className="archive-tab">
      <div className="archive-header">
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.26em", color: "var(--fg-mute)" }}>
          ARCHIVE &middot; CIPHER KEYS
        </div>
        <div className="archive-cipher mono">{slot.currencies.cipherKeys}</div>
      </div>
      <div className="archive-branches">
        {ARCHIVE_BRANCHES.map((branch) => (
          <div key={branch.id} className="archive-branch">
            <div className="archive-branch-head">
              <div className="archive-branch-name">{branch.label}</div>
              <div className="archive-branch-blurb mono">{branch.blurb}</div>
            </div>
            {nodes.filter((n) => n.branch === branch.id).map((node) => {
              const owned = archive.unlocked[node.id];
              const available = isNodeAvailable(archive, node);
              const affordable = slot.currencies.cipherKeys >= node.cost;
              return (
                <div
                  key={node.id}
                  className={`archive-node${owned ? " owned" : available ? " ready" : " locked"}`}
                >
                  <div className="archive-node-head">
                    <div className="archive-node-name">{node.name}</div>
                    <div className="archive-node-cost mono">
                      {owned ? "UNLOCKED" : `${node.cost} CIPHER`}
                    </div>
                  </div>
                  <div className="archive-node-desc mono">{node.description}</div>
                  {!owned && (
                    <button
                      className="lo-btn primary"
                      onClick={() => onBuy(node.id)}
                      disabled={!available || !affordable}
                      title={!available ? "Unlock the previous tier first" : undefined}
                    >
                      {!available ? "LOCKED" : affordable ? "UNLOCK" : "INSUFFICIENT"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

