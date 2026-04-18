import { describe, it, expect } from "vitest";
import { createRunState } from "./runState.ts";
import { simulateTick } from "./tick.ts";
import { createArsenalSlotState } from "../meta/arsenals.ts";

describe("Arsenals — sim integration", () => {
  it("Seeker Salvo fires after its cooldown elapses and creates projectiles", () => {
    const run = createRunState(7n);
    const slot = createArsenalSlotState();
    slot.levels["seeker-salvo"] = 1;
    slot.equipped["seeker-salvo"] = true;
    run.arsenalSlot = slot;
    // Seed one enemy so Seeker has a target.
    run.enemies.push({
      id: 999,
      archetype: "drone",
      pos: { x: 100, y: 0 },
      prevPos: { x: 100, y: 0 },
      vel: { x: 0, y: 0 },
      hp: 100,
      maxHp: 100,
      radius: 4,
      speed: 0,
      contactDamage: 0,
      alloyReward: 0,
      state: "approaching",
      spawnedAtCycle: 1,
      attackCooldown: 0,
    });
    // base cooldown is 8s; run ~8.1s at 60 Hz = 486 ticks to be safe
    const beforeCount = run.projectiles.length;
    for (let i = 0; i < 490; i++) simulateTick(run);
    expect(run.projectiles.length).toBeGreaterThan(beforeCount);
  });

  it("Stasis Field adds slow debuffs to nearby enemies when it fires", () => {
    const run = createRunState(11n);
    const slot = createArsenalSlotState();
    slot.levels["stasis-field"] = 1;
    slot.equipped["stasis-field"] = true;
    run.arsenalSlot = slot;
    // Plant a close-range enemy so it ends up inside the field.
    run.enemies.push({
      id: 555,
      archetype: "drone",
      pos: { x: 50, y: 0 },
      prevPos: { x: 50, y: 0 },
      vel: { x: 0, y: 0 },
      hp: 50,
      maxHp: 50,
      radius: 4,
      speed: 40,
      contactDamage: 0,
      alloyReward: 0,
      state: "approaching",
      spawnedAtCycle: 1,
      attackCooldown: 0,
    });
    // Stasis fires on tick 1 (cooldown starts at 0). Check the debuff is applied
    // before its 2.2s duration expires.
    simulateTick(run);
    expect(run.arsenals.slowedUntil.size).toBeGreaterThan(0);
  });
});
