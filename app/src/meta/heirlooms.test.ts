import { describe, it, expect } from "vitest";
import {
  applyHeirloomStats,
  createHeirloomSlotState,
  equipHeirloom,
  grantHeirloom,
  heirloomResearchMultiplier,
  heirloomScripMultiplier,
} from "./heirlooms.ts";
import { DEFAULT_SENTINEL_STATS } from "../sim/runState.ts";

describe("Heirlooms", () => {
  it("cannot equip a Heirloom the player has not earned", () => {
    const s = createHeirloomSlotState();
    equipHeirloom(s, 0, "warmind-relic");
    expect(s.equipped[0]).toBeNull();
  });

  it("applyHeirloomStats adds the equipped multipliers", () => {
    const s = createHeirloomSlotState();
    grantHeirloom(s, "warmind-relic"); // +8% damage
    equipHeirloom(s, 0, "warmind-relic");
    const stats = { ...DEFAULT_SENTINEL_STATS };
    applyHeirloomStats(s, stats);
    expect(stats.damage).toBeCloseTo(DEFAULT_SENTINEL_STATS.damage * 1.08);
  });

  it("heirloomResearchMultiplier stacks Catalyst Seed + Chronometer", () => {
    const s = createHeirloomSlotState();
    grantHeirloom(s, "catalyst-seed");
    grantHeirloom(s, "chronometer");
    equipHeirloom(s, 0, "catalyst-seed");
    equipHeirloom(s, 1, "chronometer");
    // 1.15 * 1.25 = 1.4375
    expect(heirloomResearchMultiplier(s)).toBeCloseTo(1.4375);
  });

  it("heirloomScripMultiplier returns 1 when no scrip heirloom equipped", () => {
    const s = createHeirloomSlotState();
    grantHeirloom(s, "warmind-relic");
    equipHeirloom(s, 0, "warmind-relic");
    expect(heirloomScripMultiplier(s)).toBe(1);
  });

  it("heirloomScripMultiplier picks up Argent Coil", () => {
    const s = createHeirloomSlotState();
    grantHeirloom(s, "argent-coil");
    equipHeirloom(s, 0, "argent-coil");
    expect(heirloomScripMultiplier(s)).toBeCloseTo(1.15);
  });
});
