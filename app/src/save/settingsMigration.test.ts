import { describe, it, expect } from "vitest";
import { migrate } from "./migrations.ts";
import { createEmptySlot, CURRENT_SCHEMA } from "./schema.ts";

describe("Settings migrations", () => {
  it("v9 → v10 seeds musicVolume/sfxVolume from audioVolume + default telemetry off", () => {
    const v9Slot = {
      ...createEmptySlot(1, "t"),
      schemaVersion: 9,
      settings: {
        audioVolume: 0.8,
        lowVfx: false,
        reducedMotion: false,
        colorBlindPalette: "default",
        muteAutoBuy: true,
      },
    } as unknown as Record<string, unknown>;

    const migrated = migrate(v9Slot);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(migrated.settings.musicVolume).toBeCloseTo(0.5);
    expect(migrated.settings.sfxVolume).toBeCloseTo(0.8);
    expect(migrated.settings.telemetryOptIn).toBe(false);
    expect(migrated.settings.gamepadDeadzone).toBeCloseTo(0.15);
    expect(migrated.settings.keyBindings.pause).toBeNull();
  });

  it("migration chain handles older schemas end-to-end", () => {
    const v1Slot = {
      ...createEmptySlot(1, "t"),
      schemaVersion: 1,
    } as unknown as Record<string, unknown>;
    delete v1Slot["researchBay"];
    delete v1Slot["selectedStratum"];
    delete v1Slot["achievements"];
    const migrated = migrate(v1Slot);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(migrated.researchBay).toBeDefined();
    expect(migrated.archive).toBeDefined();
    expect(migrated.settings.keyBindings).toBeDefined();
  });
});
