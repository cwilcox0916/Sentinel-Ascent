import { useEffect, useRef } from "react";
import { RunRenderer } from "../render/runRenderer.ts";
import { createRunState } from "../sim/runState.ts";
import type { RunState } from "../sim/types.ts";
import {
  projectAutoProcurement,
  projectForgeRows,
  projectLoadout,
  projectRun,
  useRunStore,
  type AutoBuyToast,
} from "../store/runStore.ts";
import {
  buyProtocolCopy,
  equipProtocol,
  levelUpProtocol,
} from "../meta/protocols.ts";
import { buyAugment, equipAugment } from "../meta/augments.ts";
import { buyArsenal, toggleArsenalEquipped } from "../meta/arsenals.ts";
import { chooseBoon } from "../meta/boons.ts";
import { equipHeirloom, heirloomResearchMultiplier } from "../meta/heirlooms.ts";
import { equipConstruct } from "../meta/constructs.ts";
import { useAppStore } from "../store/appStore.ts";
import { useSaveStore } from "../store/saveStore.ts";
import { buyUpgrade as buyUpgradeAction, recomputeSentinelStats } from "../meta/buyUpgrade.ts";
import { Autosave } from "../save/autosave.ts";
import { restoreRun, snapshotRun } from "../save/snapshot.ts";
import {
  addTier4RuleFromTemplate,
  removeTier4Rule,
  setTier1Category,
  setTier1Enabled,
  setTier2Channel,
  setTier2Reserve,
  setTier3Fairness,
  setTier3Priority,
  setTier3StatEnabled,
  setTier4Mode,
  setUnlockedTier,
  toggleTier4Rule,
  type AutoProcurementTier,
} from "../sim/autoProcurement.ts";
import { getUpgrade, type UpgradeId } from "../meta/forge.ts";
import {
  drainCompletions,
  progressResearch,
  type ProjectId,
  type ResearchBayState,
} from "../meta/researchBay.ts";
import { getStratum } from "../meta/strata.ts";
import { RunLog, type RunLogSnapshot } from "../meta/runLog.ts";
import type { DefeatSummary } from "../store/runStore.ts";
import { checkMilestones, createMilestoneRunState } from "../econ/milestones.ts";
import {
  checkCycleAchievements,
  checkLoadoutAchievements,
  checkResearchAchievements,
  recordAlloyEarned,
  recordBehemothKill,
} from "../econ/achievements.ts";
import { recordContribution, rolloverWeek } from "../econ/order.ts";
import { recordTrialRun } from "../econ/weeklyTrial.ts";
import { wardenOnBehemothKill } from "../meta/warden.ts";
import { logEvent as telemetryEvent } from "../platform/telemetry.ts";

function inferCauseOfDeath(run: RunState): string {
  // Phase 7 stub: the last enemy to contact the Sentinel at time of death.
  // Phase 8 (Defeat overlay) will track this precisely with a timeline.
  const threats = run.enemies.filter((e) => e.state !== "dying");
  if (threats.length === 0) return "Overwhelmed";
  const hasBehemoth = threats.some((e) => e.archetype === "behemoth");
  if (hasBehemoth) return "Behemoth";
  const counts = new Map<string, number>();
  for (const e of threats) counts.set(e.archetype, (counts.get(e.archetype) ?? 0) + 1);
  let worstArch = "Drone";
  let worstN = 0;
  for (const [a, n] of counts) {
    if (n > worstN) { worstN = n; worstArch = a; }
  }
  return worstArch[0]!.toUpperCase() + worstArch.slice(1) + " swarm";
}

function inferCauseDetail(run: RunState): string {
  const threats = run.enemies.filter((e) => e.state !== "dying");
  if (threats.some((e) => e.archetype === "behemoth")) {
    return `Behemoth breached the Grid at Cycle ${run.cycle} — Sentinel overwhelmed`;
  }
  const count = threats.length;
  if (count >= 8) return `${count} hostiles at the core — Sentinel surrounded`;
  if (count >= 3) return `${count} hostiles inside engagement radius — health depleted`;
  return `Sustained pressure at Cycle ${run.cycle} drained Sentinel health`;
}

function inferUnlockedApTier(rb: ResearchBayState): 0 | AutoProcurementTier {
  if ((rb.levels["autoProcurement_T4"] ?? 0) >= 1) return 4;
  if ((rb.levels["autoProcurement_T3"] ?? 0) >= 1) return 3;
  if ((rb.levels["autoProcurement_T2"] ?? 0) >= 1) return 2;
  if ((rb.levels["autoProcurement_T1"] ?? 0) >= 1) return 1;
  return 0;
}

const AP_TIER_BY_PROJECT: Partial<Record<ProjectId, AutoProcurementTier>> = {
  autoProcurement_T1: 1,
  autoProcurement_T2: 2,
  autoProcurement_T3: 3,
  autoProcurement_T4: 4,
};

const SUMMARY_HZ = 10;
const SUMMARY_MS = 1000 / SUMMARY_HZ;

/**
 * Stage — owns the PixiJS renderer + the active RunState.
 * Phase 3: backed by the active save slot. Resumes from runSnapshot if present;
 * autosaves on Cycle complete + meta purchase + visibility change + run end.
 */
export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RunRenderer | null>(null);
  const runRef = useRef<RunState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Clear any stale defeat summary from a previous run before we remount.
    useRunStore.getState().setDefeat(null);

    const slot = useAppStore.getState().activeSlot;
    if (!slot) {
      // No slot picked — bounce back to title.
      useAppStore.getState().setRoute("title");
      return;
    }

    // Resume from snapshot if one is present, else fresh deterministic run.
    let run: RunState;
    if (slot.runSnapshot) {
      run = restoreRun(slot.runSnapshot);
    } else {
      // Seed diversifier: slot id ⊕ creation time ⊕ runsLaunched so each Launch
      // produces a distinct-but-replayable sequence.
      const seed =
        BigInt(slot.slotId) * 0x9e3779b97f4a7c15n +
        BigInt(slot.profile.createdAt) +
        BigInt(slot.runsLaunched) * 0xbf58476d1ce4e5b9n;
      const stratumDef = getStratum(slot.selectedStratum);
      run = createRunState(seed, { stratum: stratumDef.id, stratumScale: stratumDef.baseScale });
      // Inherit whatever Auto-Procurement tier the player has researched at the slot level.
      const researchedTier = inferUnlockedApTier(slot.researchBay);
      if (researchedTier > 0) {
        run.autoProcurement.unlockedTier = researchedTier;
        run.autoProcurement.activeTier = researchedTier;
      }
    }
    // Phase 10: attach shared slot loadout references so sim reads equipped levels.
    run.protocolSlot = slot.protocols;
    run.augmentSlot = slot.augments;
    run.arsenalSlot = slot.arsenals;
    // Phase 11: Heirlooms + Constructs.
    run.heirloomSlot = slot.heirlooms;
    run.constructSlot = slot.constructs;
    // Phase 13: Warden.
    run.wardenSlot = slot.warden;
    // Phase 14: Archive tech tree.
    run.archive = slot.archive;
    // Rebuild Sentinel stats with Protocols + Augments layered on base.
    recomputeSentinelStats(run);
    runRef.current = run;

    const renderer = new RunRenderer();
    rendererRef.current = renderer;
    void renderer.start(canvas, run);

    const runStartedAt = Date.now();
    // Phase 17 telemetry: run start.
    telemetryEvent("run-start", { stratum: run.stratum, seed: run.seed.toString() });
    const runLog = new RunLog(runStartedAt);

    // Seed the log with a RUN START marker so the timeline never looks empty.
    runLog.pushEvent("event", `Run launched on Stratum ${run.stratum}`, run.cycle, "INIT", runStartedAt);

    let defeatCommitted = false;
    let prevKills = 0;
    let prevDamage = 0;
    let prevCycle = run.cycle;
    let prevBehemothAlive = false;
    let prevAlloy = run.alloy;
    // Phase 12: milestone tracker + achievement refresh cache.
    const milestoneState = createMilestoneRunState();
    milestoneState.lastGrantedCycle = run.cycle; // skip retroactive grants on snapshot resume
    // Phase 13: weekly Order rollover happens on Stage mount (covers idle players returning).
    rolloverWeek(slot.order, slot.currencies, new Date());
    const notifyAchievements = (ids: string[]): void => {
      if (ids.length === 0) return;
      // Phase 12: simple console signal; a toast / notification stack lands in polish.
      if (import.meta.env.DEV) console.info("[achievements]", ids);
    };

    // Autosave wired to the active slot. We snapshot the live run on every save.
    const autosave = new Autosave(() => {
      if (run.ended) {
        // Capture a Last Run summary once. The summary only writes on the first
        // save AFTER the run ends, so we don't overwrite with subsequent flushes.
        if (!slot.lastRun || slot.lastRun.endedAt < runStartedAt) {
          slot.lastRun = {
            endedAt: Date.now(),
            stratum: run.stratum,
            cyclesReached: run.cycle,
            alloyEarned: run.alloy,
            prismsEarned: 0, // Phase 12 tracks Prism grants per-run
            runtimeMs: Date.now() - runStartedAt,
            causeOfDeath: inferCauseOfDeath(run),
          };
        }
        slot.runSnapshot = null;
      } else {
        slot.runSnapshot = snapshotRun(run);
      }
      slot.metadata.lastPlayedAt = Date.now();
      slot.metadata.highestCycle = Math.max(slot.metadata.highestCycle, run.cycle);
      return slot;
    });
    const unsubFlash = autosave.onSave(({ ok }) => {
      if (ok) useSaveStore.getState().flash();
    });

    // Wire UI store
    const store = useRunStore.getState();
    store.setSummary(projectRun(run));
    store.setForgeRows(projectForgeRows(run));
    store.setAutoProcurement(projectAutoProcurement(run));
    const loadoutNow = projectLoadout(run);
    if (loadoutNow) store.setLoadout(loadoutNow);
    store.registerActions({
      buyUpgrade: (id) => {
        const result = buyUpgradeAction(run, id);
        useRunStore.getState().setSummary(projectRun(run));
        useRunStore.getState().setForgeRows(projectForgeRows(run));
        if (result === "bought") autosave.request("metaPurchase");
      },
      setAutoProcurementCategory: (cat) => {
        setTier1Category(run, cat);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setAutoProcurementEnabled: (enabled) => {
        setTier1Enabled(run, enabled);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setTier2ChannelEnabled: (cat, enabled) => {
        setTier2Channel(run, cat, enabled);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setTier2ChannelReserve: (cat, reserve) => {
        setTier2Reserve(run, cat, reserve);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setTier3StatEnabled: (id, enabled) => {
        setTier3StatEnabled(run, id, enabled);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setTier3StatPriority: (id, priority) => {
        setTier3Priority(run, id, priority);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setTier3Fairness: (on) => {
        setTier3Fairness(run, on);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      addTier4Rule: (template) => {
        addTier4RuleFromTemplate(run, template);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      removeTier4Rule: (ruleId) => {
        removeTier4Rule(run, ruleId);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      toggleTier4Rule: (ruleId, enabled) => {
        toggleTier4Rule(run, ruleId, enabled);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setTier4Mode: (mode) => {
        setTier4Mode(run, mode);
        useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
        autosave.request("metaPurchase");
      },
      setActiveTier: (tier) => {
        if (tier <= run.autoProcurement.unlockedTier) {
          run.autoProcurement.activeTier = tier;
          useRunStore.getState().setAutoProcurement(projectAutoProcurement(run));
          autosave.request("metaPurchase");
        }
      },
      equipProtocol: (slotIx, id) => {
        if (!run.protocolSlot) return;
        // Lock equips while a Behemoth is alive (spec §6).
        const hasBehemoth = run.enemies.some((e) => e.archetype === "behemoth" && e.state !== "dying");
        if (hasBehemoth) return;
        equipProtocol(run.protocolSlot, slotIx, id);
        recomputeSentinelStats(run);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      levelUpProtocol: (id) => {
        if (!run.protocolSlot) return;
        levelUpProtocol(run.protocolSlot, id);
        recomputeSentinelStats(run);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      buyProtocolCopy: (id) => {
        if (!run.protocolSlot) return;
        buyProtocolCopy(run.protocolSlot, slot.currencies, id);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      equipAugment: (slotIx, id) => {
        if (!run.augmentSlot) return;
        equipAugment(run.augmentSlot, slotIx, id);
        recomputeSentinelStats(run);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      buyAugmentLevel: (id) => {
        if (!run.augmentSlot) return;
        buyAugment(run.augmentSlot, slot.currencies, id);
        recomputeSentinelStats(run);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      toggleArsenalEquipped: (id, enabled) => {
        if (!run.arsenalSlot) return;
        toggleArsenalEquipped(run.arsenalSlot, id, enabled);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      buyArsenalLevel: (id) => {
        if (!run.arsenalSlot) return;
        buyArsenal(run.arsenalSlot, slot.currencies, id);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      chooseBoon: (id) => {
        chooseBoon(run, id);
        recomputeSentinelStats(run);
        useRunStore.getState().setSummary(projectRun(run));
        autosave.request("metaPurchase");
      },
      equipHeirloom: (slotIx, id) => {
        if (!run.heirloomSlot) return;
        equipHeirloom(run.heirloomSlot, slotIx, id);
        recomputeSentinelStats(run);
        publishLoadout();
        autosave.request("metaPurchase");
      },
      equipConstruct: (id) => {
        if (!run.constructSlot) return;
        equipConstruct(run.constructSlot, id);
        recomputeSentinelStats(run);
        publishLoadout();
        autosave.request("metaPurchase");
      },
    });

    function publishLoadout(): void {
      const l = projectLoadout(run);
      if (l) useRunStore.getState().setLoadout(l);
      // Phase 12: loadout achievements fire on every equip/purchase change.
      notifyAchievements(checkLoadoutAchievements(slot!));
    }

    // Cycle-complete autosave: poll the run's cycle each summary tick and fire on change.
    let lastCycle = run.cycle;
    let toastSeq = 0;
    let lastDrainedPulseTick = -1;

    const summaryTimer = window.setInterval(() => {
      const s = useRunStore.getState();
      s.setSummary(projectRun(run));
      s.setForgeRows(projectForgeRows(run));
      s.setAutoProcurement(projectAutoProcurement(run));

      // --- Run Log telemetry (host-side, does not touch sim determinism). ---
      const nowMs = Date.now();
      const hpFrac = run.sentinel.stats.maxHealth > 0
        ? Math.max(0, run.sentinel.stats.health / run.sentinel.stats.maxHealth)
        : 0;
      runLog.sampleHp(hpFrac, run.cycle, nowMs);
      const dmgDelta = run.stats.damageDealt - prevDamage;
      prevDamage = run.stats.damageDealt;
      if (dmgDelta > 0) runLog.recordDamage(dmgDelta, nowMs);
      const killDelta = run.stats.kills - prevKills;
      prevKills = run.stats.kills;
      if (killDelta > 0) runLog.addKills(killDelta);

      // Behemoth entry/exit events.
      const behemothAlive = run.enemies.some(
        (e) => e.archetype === "behemoth" && e.state !== "dying",
      );
      if (behemothAlive && !prevBehemothAlive) {
        runLog.pushEvent("bad", `Behemoth on Grid (Cycle ${run.cycle})`, run.cycle, "BHM", nowMs);
      } else if (!behemothAlive && prevBehemothAlive) {
        runLog.pushEvent("good", "Behemoth defeated", run.cycle, "KILL", nowMs);
        notifyAchievements(recordBehemothKill(slot));
        telemetryEvent("behemoth-killed", { cycle: run.cycle });
        // Phase 17 balance pass: every Behemoth guarantees +1 Prism
        // (economy doc §4: "small Prism chance on every Behemoth kill").
        slot.currencies.prisms += 1;
        // Phase 13: Fetch Subroutine roll for additional Prism drop on Behemoth kill.
        const fetched = wardenOnBehemothKill(run, slot.currencies);
        if (fetched > 0 && import.meta.env.DEV) console.info("[warden] fetch granted", fetched);
      }
      prevBehemothAlive = behemothAlive;

      // Cycle-milestone events (every 10 Cycles).
      if (run.cycle !== prevCycle && run.cycle % 10 === 0) {
        runLog.pushEvent("event", `Cycle ${run.cycle} reached`, run.cycle, `C${run.cycle}`, nowMs);
      }

      // Advance Research Bay projects in real wall-clock time. Runs whether the
      // overlay is open or closed. Completions fire the rail-button glow.
      const now = Date.now();
      const hMult = heirloomResearchMultiplier(slot.heirlooms);
      const progressResult = progressResearch(
        slot.researchBay,
        { alloy: slot.currencies.alloy, catalyst: slot.currencies.catalyst },
        now,
        hMult,
      );
      if (progressResult.completed.length > 0) {
        slot.currencies.alloy -= progressResult.alloySpent;
        slot.currencies.catalyst -= progressResult.catalystSpent;
        // Dispatch AP tier unlocks into the live run (and future runs via slot inference).
        for (const pid of progressResult.completed) {
          const tier = AP_TIER_BY_PROJECT[pid];
          if (tier != null) setUnlockedTier(run, tier);
        }
        // Drain completion events. Always set the rail glow — the Rail click-to-open
        // handler clears it. This avoids a race where Esc closes the bay between
        // completion and this check, suppressing the glow.
        drainCompletions(slot.researchBay);
        useAppStore.getState().setRailGlow(true);
        // Phase 12: research-based achievements.
        for (const pid of progressResult.completed) {
          notifyAchievements(checkResearchAchievements(slot, pid as string));
        }
        autosave.request("metaPurchase");
      }

      // Drain Auto-Procurement pulses: paint .auto-bought and push toasts.
      const pulses = run.autoProcurement.pulses;
      if (pulses.length) {
        const recent: Record<UpgradeId, number> = { ...s.recentAutoBuys };
        const now = Date.now();
        let pushed = 0;
        for (const p of pulses) {
          if (p.tickNumber <= lastDrainedPulseTick) continue;
          recent[p.upgradeId] = now;
          if (pushed < 3) {
            // Throttle toast spam: at most 3 per drain cycle (10 Hz cadence).
            const toast: AutoBuyToast = {
              key: `t-${++toastSeq}`,
              upgradeId: p.upgradeId,
              category: p.category,
              cost: p.cost,
              upgradeName: getUpgrade(p.upgradeId).name,
              bornAt: now,
            };
            s.pushAutoBuyToast(toast);
            pushed += 1;
          }
        }
        s.setRecentAutoBuys(recent);
        lastDrainedPulseTick = pulses[pulses.length - 1]!.tickNumber;
        // Trim drained pulses so the ring doesn't grow unbounded.
        run.autoProcurement.pulses = [];
      }

      if (run.cycle !== lastCycle) {
        const cyclesAdded = run.cycle - lastCycle;
        lastCycle = run.cycle;
        prevCycle = run.cycle;
        if (run.cycle % 25 === 0) telemetryEvent("cycle-milestone", { cycle: run.cycle });
        // Phase 12: Stratum milestones (every 50 Cycles) + cycle-based achievements.
        const grants = checkMilestones(slot, run, milestoneState);
        if (grants.length > 0 && import.meta.env.DEV) {
          console.info("[milestones]", grants);
        }
        notifyAchievements(checkCycleAchievements(slot, run));
        // Phase 13: Order weekly contribution counts every Cycle the player clears.
        if (cyclesAdded > 0) recordContribution(slot.order, cyclesAdded);
        autosave.request("cycleComplete");
      }

      // Phase 14: drain fleet drops into slot currencies.
      if (run.fleetDrops.fluxCrystals > 0 || run.fleetDrops.augmentFragments > 0) {
        slot.currencies.fluxCrystals += run.fleetDrops.fluxCrystals;
        slot.currencies.augmentFragments += run.fleetDrops.augmentFragments;
        run.fleetDrops.fluxCrystals = 0;
        run.fleetDrops.augmentFragments = 0;
        autosave.request("metaPurchase");
      }

      // Phase 12: track Alloy earned for lifetime achievements.
      if (run.alloy !== prevAlloy) {
        const delta = run.alloy - prevAlloy;
        if (delta > 0) notifyAchievements(recordAlloyEarned(slot, delta));
        prevAlloy = run.alloy;
      }
      if (run.ended) {
        autosave.request("runEnd");
        if (!defeatCommitted) {
          defeatCommitted = true;
          telemetryEvent("run-end", {
            cycle: run.cycle,
            kills: run.stats.kills,
            alloyEarned: run.alloy,
            runtimeMs: Date.now() - runStartedAt,
          });
          telemetryEvent("defeat", { cycle: run.cycle, cause: inferCauseOfDeath(run) });
          // Phase 13: every completed run also counts as a Weekly Trial submission
          // since the meta-progression carries over per spec §16.
          recordTrialRun(slot.weeklyTrial, slot.currencies, run.cycle);
          runLog.pushEvent("death", "Sentinel offline", run.cycle, "END", Date.now());
          // One final HP sample at zero so the sparkline terminates at death.
          runLog.sampleHp(0, run.cycle, Date.now() + 1);
          const logSnap: RunLogSnapshot = runLog.snapshot(Date.now(), run.cycle);
          const pb = slot.metadata.highestCycle;
          const defeat: DefeatSummary = {
            stratum: run.stratum,
            causeOfDeath: inferCauseOfDeath(run),
            causeDetail: inferCauseDetail(run),
            scripEarned: run.scrip,
            alloyEarned: run.alloy,
            personalBestCycle: Math.max(pb, run.cycle),
            personalBestDelta: run.cycle - pb,
            log: logSnap,
            rewards: {
              alloy: run.alloy,
              catalyst: 0,
              prisms: 0,
              cipher: 0,
            },
            heirloomDrop: null,
          };
          useRunStore.getState().setDefeat(defeat);
        }
      }
    }, SUMMARY_MS);

    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        void autosave.flushNow("visibilityChange");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Dev-only debug hooks. Handy for visual regression + rapid design iteration.
    // Stripped from production by Vite (import.meta.env.DEV is a boolean literal).
    if (import.meta.env.DEV) {
      (window as unknown as { __sa?: unknown }).__sa = {
        run,
        slot,
        jumpToCycle: (c: number) => {
          run.cycle = Math.max(1, Math.floor(c));
          run.cycleProgressMs = 0;
          run.cycleEnemyBudget = 0;
          run.cycleSpawnAccumulator = 0;
          run.spawnerState.behemothSpawnedThisCycle = false;
        },
        /** Fast-forward every in-flight research job by `seconds`. */
        skipResearch: (seconds: number) => {
          const deltaMs = Math.max(0, Math.floor(seconds * 1000));
          for (const rslot of slot.researchBay.slots) {
            if (rslot.job && !rslot.job.queued) {
              rslot.job.startedAt -= deltaMs;
              rslot.job.completesAt -= deltaMs;
            }
          }
        },
        /** Finish every in-flight research job immediately. */
        finishResearch: () => {
          const now = Date.now();
          for (const rslot of slot.researchBay.slots) {
            if (rslot.job && !rslot.job.queued) {
              rslot.job.completesAt = now - 1;
            }
          }
        },
        /** Grant currencies for testing. */
        grant: (delta: { alloy?: number; catalyst?: number; prisms?: number }) => {
          slot.currencies.alloy += delta.alloy ?? 0;
          slot.currencies.catalyst += delta.catalyst ?? 0;
          slot.currencies.prisms += delta.prisms ?? 0;
        },
      };
    }

    return () => {
      // Defensive flush so closing the tab persists current state.
      void autosave.flushNow("visibilityChange");
      window.clearInterval(summaryTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubFlash();
      renderer.destroy();
      rendererRef.current = null;
      runRef.current = null;
    };
  }, []);

  return (
    <main className="stage">
      <canvas id="grid-canvas" ref={canvasRef} />
      <StageHud />
    </main>
  );
}

/** In-stage HUD overlays — locked structure per docs/my_game/10-design-system.md §4. */
function StageHud() {
  const summary = useRunStore((s) => s.summary);
  const hpPct = summary.maxHealth > 0 ? (summary.health / summary.maxHealth) * 100 : 0;
  const behemoth = summary.behemoth;
  const behemothPct = behemoth ? Math.max(0, (behemoth.hp / behemoth.maxHp) * 100) : 0;
  const nextBehemoth = summary.cyclesToNextBehemoth;
  const showBanner = !behemoth && nextBehemoth === 1;

  return (
    <>
      <div className="stage-overlay hp-cluster">
        <div className="hp-row">
          <span className="lbl">HEALTH</span>
          <div className="hp-bar">
            <div className="hp-fill health" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="num mono">
            {Math.max(0, Math.round(summary.health))} / {Math.round(summary.maxHealth)}
          </span>
        </div>
      </div>

      <div className="stage-overlay cycle-badge">
        <div className="stratum">
          <div className="label">STRATUM</div>
          <div className="num mono">01</div>
        </div>
        <div>
          <div className="label">CYCLE</div>
          <div className="num mono">{String(summary.cycle).padStart(2, "0")}</div>
        </div>
        <div>
          <div className="label">NEXT BEHEMOTH</div>
          <div className="num mono" style={{ color: "var(--threat)" }}>{nextBehemoth}</div>
        </div>
        <div>
          <div className="label">ENEMIES</div>
          <div className="num mono" style={{ color: "var(--threat)" }}>{summary.enemyCount}</div>
        </div>
      </div>

      {behemoth && (
        <div className="behemoth-hp show">
          <div className="label">BEHEMOTH · CYCLE {String(summary.cycle).padStart(2, "0")}</div>
          <div className="bar">
            <div className="fill" style={{ width: `${behemothPct}%` }} />
          </div>
        </div>
      )}

      {(behemoth || showBanner) && (
        <div className="behemoth-banner show">
          {behemoth
            ? "⚠ BEHEMOTH ON GRID — PROTOCOLS LOCKED"
            : "⚠ BEHEMOTH INCOMING — NEXT CYCLE"}
        </div>
      )}

      <div className="stage-legend">
        <div className="k"><span className="dot" style={{ background: "var(--cyan)" }} /> Sentinel</div>
        <div className="k"><span className="dot" style={{ background: "var(--threat)" }} /> Drone</div>
        <div className="k"><span className="dot" style={{ background: "#ff5a6e" }} /> Skimmer</div>
        <div className="k"><span className="dot" style={{ background: "#ff9a4a" }} /> Hulk</div>
        <div className="k"><span className="dot" style={{ background: "#ff7a4a" }} /> Lancer</div>
        <div className="k"><span className="dot" style={{ background: "#ff2f79" }} /> Behemoth</div>
      </div>

      {/* Phase 8: death is surfaced via the Defeat overlay mounted in App.tsx. */}
    </>
  );
}
