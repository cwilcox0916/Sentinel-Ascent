import { describe, it, expect } from "vitest";
import { createRunState } from "../sim/runState.ts";
import {
  applyForge,
  createForgeState,
  getUpgrade,
  listUpgrades,
  listUpgradesByCategory,
  nextCost,
} from "./forge.ts";
import { buyUpgrade } from "./buyUpgrade.ts";

describe("Forge cost curves", () => {
  it("first level costs the base", () => {
    for (const def of listUpgrades()) {
      expect(nextCost(def, 0)).toBe(def.baseCost);
    }
  });

  it("costs grow exponentially with level", () => {
    const def = getUpgrade("damage");
    expect(nextCost(def, 5)).toBeGreaterThan(nextCost(def, 0));
    expect(nextCost(def, 5)).toBe(Math.ceil(def.baseCost * Math.pow(def.costMultiplier, 5)));
  });

  it("category lists are non-empty and disjoint", () => {
    const a = listUpgradesByCategory("attack");
    const d = listUpgradesByCategory("defense");
    const u = listUpgradesByCategory("utility");
    expect(a.length).toBeGreaterThan(0);
    expect(d.length).toBeGreaterThan(0);
    expect(u.length).toBeGreaterThan(0);
    const ids = new Set([...a, ...d, ...u].map((x) => x.id));
    expect(ids.size).toBe(a.length + d.length + u.length);
  });
});

describe("applyForge", () => {
  it("layers on top of base stats", () => {
    const base = { ...createRunState(1n).baseSentinelStats };
    const forge = createForgeState();
    const out = { ...base };

    forge.levels["damage"] = 3;
    applyForge(base, forge, out);
    expect(out.damage).toBe(base.damage + 3 * 2);
  });

  it("is idempotent — recomputing from base produces same result", () => {
    const base = { ...createRunState(1n).baseSentinelStats };
    const forge = createForgeState();
    forge.levels["damage"] = 5;
    forge.levels["range"] = 2;

    const a = { ...base };
    const b = { ...base };
    applyForge(base, forge, a);
    applyForge(base, forge, b);
    expect(a).toEqual(b);
  });

  it("buying Health raises max and heals by the diff", () => {
    const run = createRunState(1n);
    run.scrip = 1000;
    run.sentinel.stats.health = 50; // simulate damage taken
    const beforeMax = run.sentinel.stats.maxHealth;

    expect(buyUpgrade(run, "health")).toBe("bought");
    const afterMax = run.sentinel.stats.maxHealth;
    expect(afterMax).toBeGreaterThan(beforeMax);
    expect(run.sentinel.stats.health).toBe(50 + (afterMax - beforeMax));
  });
});

describe("buyUpgrade", () => {
  it("rejects when Scrip is insufficient", () => {
    const run = createRunState(1n);
    run.scrip = 0;
    expect(buyUpgrade(run, "damage")).toBe("unaffordable");
    expect(run.forge.levels["damage"]).toBe(0);
  });

  it("deducts cost and increments level on success", () => {
    const run = createRunState(1n);
    run.scrip = 1000;
    const def = getUpgrade("damage");
    const cost0 = nextCost(def, 0);

    expect(buyUpgrade(run, "damage")).toBe("bought");
    expect(run.forge.levels["damage"]).toBe(1);
    expect(run.scrip).toBe(1000 - cost0);
  });

  it("recomputes Sentinel.stats so subsequent shots use the new value", () => {
    const run = createRunState(1n);
    run.scrip = 1000;
    const baseDamage = run.sentinel.stats.damage;
    buyUpgrade(run, "damage");
    expect(run.sentinel.stats.damage).toBe(baseDamage + 2);
  });

  it("rejects if the run has ended", () => {
    const run = createRunState(1n);
    run.scrip = 1000;
    run.ended = true;
    expect(buyUpgrade(run, "damage")).toBe("ended");
  });
});
