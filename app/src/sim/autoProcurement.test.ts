import { describe, it, expect } from "vitest";
import type { RunState } from "./types.ts";
import { createRunState } from "./runState.ts";
import { simulateTick } from "./tick.ts";
import {
  addTier4RuleFromTemplate,
  setTier1Category,
  setTier1Enabled,
  setTier2Channel,
  setTier2Reserve,
  setTier3Fairness,
  setTier3Priority,
  setTier3StatEnabled,
  setUnlockedTier,
} from "./autoProcurement.ts";
import type { UpgradeId } from "../meta/forge.ts";
import { snapshotRun, restoreRun } from "../save/snapshot.ts";

/** Helper: fresh run with AP Tier 1 unlocked (as Research Bay would grant). */
function runWithTier(seed: bigint, tier: 1 | 2 | 3 | 4): RunState {
  const run = createRunState(seed);
  setUnlockedTier(run, tier);
  return run;
}

describe("Auto-Procurement — gating", () => {
  it("does nothing when unlockedTier is 0 (not researched)", () => {
    const run = createRunState(1n);
    run.scrip = 100_000;
    setTier1Category(run, "attack"); // tries to enable, but unlocked tier is 0
    for (let i = 0; i < 60; i++) simulateTick(run);
    expect(Object.values(run.forge.levels).every((l) => l === 0)).toBe(true);
  });
});

describe("Auto-Procurement Tier 1", () => {
  it("does nothing when disabled", () => {
    const run = runWithTier(1n, 1);
    run.scrip = 100_000;
    setTier1Enabled(run, false);
    for (let i = 0; i < 60; i++) simulateTick(run);
    expect(Object.values(run.forge.levels).every((l) => l === 0)).toBe(true);
  });

  it("buys cheapest in the chosen category once enabled", () => {
    const run = runWithTier(1n, 1);
    run.scrip = 100_000;
    setTier1Category(run, "attack");
    simulateTick(run);
    expect(run.forge.levels["damage"]).toBe(1);
  });

  it("does not buy upgrades from other categories", () => {
    const run = runWithTier(1n, 1);
    run.scrip = 100_000;
    setTier1Category(run, "defense");
    for (let i = 0; i < 30; i++) simulateTick(run);

    const defenseTotal =
      run.forge.levels["health"] +
      run.forge.levels["defensePercent"] +
      run.forge.levels["thorns"] +
      run.forge.levels["lifesteal"];
    expect(defenseTotal).toBeGreaterThan(0);

    const attackTotal =
      run.forge.levels["damage"] +
      run.forge.levels["attackSpeed"] +
      run.forge.levels["range"];
    expect(attackTotal).toBe(0);
  });

  it("emits a pulse for every successful auto-buy", () => {
    const run = runWithTier(1n, 1);
    run.scrip = 1_000;
    setTier1Category(run, "attack");
    simulateTick(run);
    expect(run.autoProcurement.pulses.length).toBe(1);
    expect(run.autoProcurement.pulses[0]?.upgradeId).toBe("damage");
  });

  it("is deterministic for the same seed + same toggle history", () => {
    const a = runWithTier(42n, 1);
    const b = runWithTier(42n, 1);
    a.scrip = 5000;
    b.scrip = 5000;
    setTier1Category(a, "attack");
    setTier1Category(b, "attack");

    for (let i = 0; i < 300; i++) {
      simulateTick(a);
      simulateTick(b);
    }
    expect(a.forge.levels).toEqual(b.forge.levels);
    expect(a.scrip).toBe(b.scrip);
  });

  it("resumes byte-identically from a snapshot mid-Auto-Procurement", () => {
    const baseline = runWithTier(7n, 1);
    baseline.scrip = 5000;
    setTier1Category(baseline, "defense");

    for (let i = 0; i < 200; i++) simulateTick(baseline);

    const snap = snapshotRun(baseline);
    for (let i = 0; i < 250; i++) simulateTick(baseline);

    const resumed = restoreRun(snap);
    for (let i = 0; i < 250; i++) simulateTick(resumed);

    expect(resumed.forge.levels).toEqual(baseline.forge.levels);
    expect(resumed.scrip).toBe(baseline.scrip);
    expect(resumed.autoProcurement.tier1).toEqual(baseline.autoProcurement.tier1);
  });
});

describe("Auto-Procurement Tier 2 (multi-channel)", () => {
  it("buys across all enabled channels in a single tick", () => {
    const run = runWithTier(1n, 2);
    run.scrip = 100_000;
    // All channels default to enabled. Running one tick should buy one stat per channel.
    simulateTick(run);
    const attackBuys = run.forge.levels["damage"];
    const defenseBuys = run.forge.levels["health"];
    const utilityBuys = run.forge.levels["alloyPerKill"];
    expect(attackBuys + defenseBuys + utilityBuys).toBeGreaterThanOrEqual(2);
  });

  it("respects per-channel reserve floor", () => {
    const run = runWithTier(1n, 2);
    run.scrip = 20; // barely enough for Damage (cost 10) OR Health (cost 14)
    setTier2Reserve(run, "defense", 20); // blocks defense spending
    setTier2Channel(run, "utility", false);
    simulateTick(run);
    expect(run.forge.levels["health"]).toBe(0);
    expect(run.forge.levels["damage"]).toBe(1);
  });
});

describe("Auto-Procurement Tier 3 (targeted)", () => {
  function disableAllExcept(run: RunState, keep: UpgradeId[]) {
    const set = new Set(keep);
    for (const id of Object.keys(run.autoProcurement.tier3.enabled) as UpgradeId[]) {
      setTier3StatEnabled(run, id, set.has(id));
    }
  }

  it("obeys priority ordering (priority 10 beats priority 5)", () => {
    const run = runWithTier(1n, 3);
    run.scrip = 1_000;
    // Let both Damage and Range be eligible; make Range priority 10, Damage 5.
    disableAllExcept(run, ["damage", "range"]);
    setTier3Priority(run, "damage", 5);
    setTier3Priority(run, "range", 10);
    simulateTick(run);
    expect(run.forge.levels["range"]).toBe(1);
    expect(run.forge.levels["damage"]).toBe(0);
  });

  it("round-robin alternates between tied-priority stats", () => {
    const run = runWithTier(1n, 3);
    run.scrip = 1_000_000;
    disableAllExcept(run, ["damage", "attackSpeed"]);
    setTier3Priority(run, "damage", 8);
    setTier3Priority(run, "attackSpeed", 8);
    setTier3Fairness(run, true);
    const sequence: UpgradeId[] = [];
    for (let i = 0; i < 6; i++) {
      const before = { ...run.forge.levels };
      simulateTick(run);
      for (const id of ["damage", "attackSpeed"] as UpgradeId[]) {
        if (run.forge.levels[id] > (before[id] ?? 0)) sequence.push(id);
      }
    }
    // Should alternate: d, a, d, a, d, a  (order of first pick is deterministic)
    expect(sequence.length).toBe(6);
    for (let i = 2; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });

  it("skips disabled stats even if they would be cheapest", () => {
    const run = runWithTier(1n, 3);
    run.scrip = 1_000;
    disableAllExcept(run, ["range"]); // damage (cost 10) is disabled
    simulateTick(run);
    expect(run.forge.levels["damage"]).toBe(0);
    expect(run.forge.levels["range"]).toBe(1);
  });

  it("snapshot resume preserves Tier 3 runtime state byte-identically", () => {
    const a = runWithTier(5n, 3);
    a.scrip = 10_000;
    setTier3Priority(a, "damage", 9);
    setTier3Priority(a, "range", 9);
    for (let i = 0; i < 150; i++) simulateTick(a);

    const snap = snapshotRun(a);
    for (let i = 0; i < 100; i++) simulateTick(a);

    const b = restoreRun(snap);
    for (let i = 0; i < 100; i++) simulateTick(b);

    expect(b.forge.levels).toEqual(a.forge.levels);
    expect(b.autoProcurement.tier3.priority).toEqual(a.autoProcurement.tier3.priority);
    expect(b.autoProcurement.tier3.lastBoughtTick).toEqual(a.autoProcurement.tier3.lastBoughtTick);
  });
});

describe("Auto-Procurement Tier 4 (rules engine)", () => {
  it("Defensive Stand template: low HP triggers ONLY_BUY defense stats", () => {
    const run = runWithTier(1n, 4);
    run.scrip = 1_000;
    addTier4RuleFromTemplate(run, "Defensive Stand");
    // Drop HP below 50% so the condition fires.
    run.sentinel.stats.maxHealth = 100;
    run.sentinel.stats.health = 30;
    simulateTick(run);
    // Only health / defensePercent / thorns are candidates under ONLY_BUY.
    const attackBought = run.forge.levels["damage"] + run.forge.levels["attackSpeed"] + run.forge.levels["range"];
    expect(attackBought).toBe(0);
    const defenseBought = run.forge.levels["health"] + run.forge.levels["defensePercent"] + run.forge.levels["thorns"];
    expect(defenseBought).toBe(1);
  });

  it("PAUSE_AUTO_BUY halts purchases for the tick", () => {
    const run = runWithTier(1n, 4);
    run.scrip = 100_000;
    addTier4RuleFromTemplate(run, "Save For Wall"); // scrip < 500 → pause
    run.scrip = 100; // force the condition to match
    simulateTick(run);
    expect(Object.values(run.forge.levels).every((l) => l === 0)).toBe(true);
  });

  it("rules beyond the 5-rule cap are rejected", () => {
    const run = runWithTier(1n, 4);
    expect(addTier4RuleFromTemplate(run, "Defensive Stand")).not.toBeNull();
    expect(addTier4RuleFromTemplate(run, "Boss Cycle Focus")).not.toBeNull();
    expect(addTier4RuleFromTemplate(run, "Save For Wall")).not.toBeNull();
    expect(addTier4RuleFromTemplate(run, "Late-Run Economy Tilt")).not.toBeNull();
    expect(addTier4RuleFromTemplate(run, "Swarm Lockdown")).not.toBeNull();
    expect(addTier4RuleFromTemplate(run, "Defensive Stand")).toBeNull();
  });

  it("first-match mode: earlier rules win over later ones", () => {
    const run = runWithTier(1n, 4);
    run.scrip = 1_000;
    // Add Defensive Stand first (ONLY_BUY defense) then Swarm Lockdown (ONLY_BUY attack).
    addTier4RuleFromTemplate(run, "Defensive Stand");
    addTier4RuleFromTemplate(run, "Swarm Lockdown");
    // Trigger both conditions.
    run.sentinel.stats.health = 20;
    for (let i = 0; i < 25; i++) run.enemies.push({
      id: 10_000 + i, archetype: "drone", pos: { x: 0, y: 0 }, prevPos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 }, hp: 1, maxHp: 1, radius: 4, speed: 0, contactDamage: 0,
      alloyReward: 0, state: "approaching", spawnedAtCycle: 1, attackCooldown: 0,
    });
    simulateTick(run);
    // Defensive Stand (first) should win → health bought, not damage.
    expect(run.forge.levels["health"]).toBe(1);
    expect(run.forge.levels["damage"]).toBe(0);
  });
});
