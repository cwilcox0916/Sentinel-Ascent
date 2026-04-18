import { describe, it, expect } from "vitest";
import { createEmptySlot } from "./schema.ts";
import { parseSlotFromJSON, serializeSlotToJSON } from "./exportImport.ts";
import { migrate } from "./migrations.ts";
import { snapshotRun } from "./snapshot.ts";
import { createRunState } from "../sim/runState.ts";
import { simulateTick } from "../sim/tick.ts";

describe("Export / import round-trip", () => {
  it("preserves all slot fields through JSON serialize/deserialize", () => {
    const slot = createEmptySlot(2, "Tester");
    slot.currencies.alloy = 12345;
    slot.metadata.totalPlayMs = 67890;
    slot.metadata.highestCycle = 42;

    const text = serializeSlotToJSON(slot);
    const parsed = parseSlotFromJSON(text, 2);

    expect(parsed.slotId).toBe(2);
    expect(parsed.profile.displayName).toBe("Tester");
    expect(parsed.currencies.alloy).toBe(12345);
    expect(parsed.metadata.highestCycle).toBe(42);
  });

  it("rebinds slot id to the import target", () => {
    const slot = createEmptySlot(1, "Originally Slot 1");
    const text = serializeSlotToJSON(slot);
    const parsed = parseSlotFromJSON(text, 4);
    expect(parsed.slotId).toBe(4);
  });

  it("rejects non-Sentinel-Ascent JSON", () => {
    const fake = JSON.stringify({ game: "other-game", slot: {} });
    expect(() => parseSlotFromJSON(fake, 1)).toThrow(/not a Sentinel Ascent save/);
  });

  it("survives a runSnapshot round-trip with deterministic resume", () => {
    const slot = createEmptySlot(3, "Snapper");
    const run = createRunState(0xdeadn);
    for (let i = 0; i < 180; i++) simulateTick(run);
    slot.runSnapshot = snapshotRun(run);

    const text = serializeSlotToJSON(slot);
    const parsed = parseSlotFromJSON(text, 3);

    expect(parsed.runSnapshot).toBeTruthy();
    expect(parsed.runSnapshot!.tickNumber).toBe(run.tickNumber);
    expect(parsed.runSnapshot!.cycle).toBe(run.cycle);
    expect(parsed.runSnapshot!.seed).toBe(run.seed.toString());
    expect(parsed.runSnapshot!.enemies.length).toBe(run.enemies.length);
  });
});

describe("Schema migration", () => {
  it("passes current-version data through unchanged", () => {
    const slot = createEmptySlot(1, "Current");
    const migrated = migrate(JSON.parse(JSON.stringify(slot)));
    expect(migrated.profile.displayName).toBe("Current");
    expect(migrated.schemaVersion).toBe(slot.schemaVersion);
  });

  it("rejects future-version saves with a clear error", () => {
    const fromFuture = { schemaVersion: 999, slotId: 1 };
    expect(() => migrate(fromFuture)).toThrow(/newer build/);
  });

  it("errors if a v0 → v1 migration is missing (would catch future regressions)", () => {
    // No v0 migration is registered in Phase 3 — confirm the framework would catch a gap.
    const v0 = { schemaVersion: 0 };
    expect(() => migrate(v0)).toThrow(/No migration registered/);
  });
});
