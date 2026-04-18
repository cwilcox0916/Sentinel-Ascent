/**
 * Save migration registry. Each entry promotes versionN data to versionN+1.
 *
 * Spec: docs/my_game/07-save-system-spec.md §5
 *
 * Rules:
 *   - Forward-only. The build refuses to load saves with `schemaVersion > CURRENT_SCHEMA`.
 *   - Never silently drop data. Unknown fields pass through to the next version.
 *   - When a migration alters balance values, add a one-time compensating bonus
 *     (e.g. refund Scrip if a stat is removed) — don't strand the player.
 */

import { CURRENT_SCHEMA, type SaveSlot } from "./schema.ts";
import { createResearchBayState } from "../meta/researchBay.ts";
import { createProtocolSlotState } from "../meta/protocols.ts";
import { createArsenalSlotState } from "../meta/arsenals.ts";
import { createAugmentSlotState } from "../meta/augments.ts";
import { createHeirloomSlotState } from "../meta/heirlooms.ts";
import { createConstructSlotState } from "../meta/constructs.ts";
import { createDailyDropState } from "../econ/dailyDrop.ts";
import { createAchievementState } from "../econ/achievements.ts";
import { createWardenSlotState } from "../meta/warden.ts";
import { createOrderState } from "../econ/order.ts";
import { createWeeklyTrialState } from "../econ/weeklyTrial.ts";
import { createArchiveState } from "../meta/archive.ts";

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migration registry. Keyed by FROM-version. To add a v1 → v2 migration:
 *   migrations[1] = (v1) => { ... return v2; };
 */
export const migrations: Record<number, Migration> = {
  /**
   * v1 → v2 (Phase 6): adds `researchBay` to the slot. Saves written before
   * Phase 6 have no research state; hydrate with the default so nothing is lost.
   */
  1: (v1) => {
    const out = { ...v1 };
    if (!out["researchBay"]) {
      out["researchBay"] = createResearchBayState();
    }
    return out;
  },
  /**
   * v2 → v3 (Phase 7): adds `selectedStratum`, `runsLaunched`, `lastRun`.
   */
  2: (v2) => {
    const out = { ...v2 };
    if (out["selectedStratum"] === undefined) out["selectedStratum"] = 1;
    if (out["runsLaunched"] === undefined) out["runsLaunched"] = 0;
    if (out["lastRun"] === undefined) out["lastRun"] = null;
    return out;
  },
  /**
   * v3 → v4 (Phase 10): adds `protocols`, `arsenals`, `augments` equipment state.
   * Pre-Phase-10 saves have none of these; hydrate with defaults.
   */
  3: (v3) => {
    const out = { ...v3 };
    if (!out["protocols"]) out["protocols"] = createProtocolSlotState();
    if (!out["arsenals"]) out["arsenals"] = createArsenalSlotState();
    if (!out["augments"]) out["augments"] = createAugmentSlotState();
    return out;
  },
  /**
   * v4 → v5 (Phase 11): adds `heirlooms`, `constructs` slot state.
   */
  4: (v4) => {
    const out = { ...v4 };
    if (!out["heirlooms"]) out["heirlooms"] = createHeirloomSlotState();
    if (!out["constructs"]) out["constructs"] = createConstructSlotState();
    return out;
  },
  /**
   * v5 → v6 (Phase 12): economy sources — Daily Drop state + Achievement Vault.
   */
  5: (v5) => {
    const out = { ...v5 };
    if (!out["dailyDrop"]) out["dailyDrop"] = createDailyDropState();
    if (!out["achievements"]) out["achievements"] = createAchievementState();
    return out;
  },
  /**
   * v6 → v7 (Phase 13): adds Warden slot, Order, Weekly Trials.
   */
  6: (v6) => {
    const out = { ...v6 };
    if (!out["warden"]) out["warden"] = createWardenSlotState();
    if (!out["order"]) out["order"] = createOrderState();
    if (!out["weeklyTrial"]) out["weeklyTrial"] = createWeeklyTrialState();
    return out;
  },
  /**
   * v7 → v8 (Phase 14): adds Archive tech tree state.
   */
  7: (v7) => {
    const out = { ...v7 };
    if (!out["archive"]) out["archive"] = createArchiveState();
    return out;
  },
  /**
   * v8 → v9 (Phase 15): settings extended with colorBlindPalette + muteAutoBuy.
   */
  8: (v8) => {
    const out = { ...v8 };
    const settings = { ...(out["settings"] as Record<string, unknown>) };
    if (settings["colorBlindPalette"] === undefined) settings["colorBlindPalette"] = "default";
    if (settings["muteAutoBuy"] === undefined) settings["muteAutoBuy"] = true;
    out["settings"] = settings;
    return out;
  },
  /**
   * v9 → v10 (Phase 16): split audio into music/sfx buses, add telemetry opt-in,
   * add key bindings + gamepad deadzone.
   */
  9: (v9) => {
    const out = { ...v9 };
    const s = { ...(out["settings"] as Record<string, unknown>) };
    const legacyVolume = typeof s["audioVolume"] === "number" ? (s["audioVolume"] as number) : 0.7;
    if (s["musicVolume"] === undefined) s["musicVolume"] = Math.min(legacyVolume, 0.5);
    if (s["sfxVolume"] === undefined) s["sfxVolume"] = legacyVolume;
    if (s["telemetryOptIn"] === undefined) s["telemetryOptIn"] = false;
    if (s["gamepadDeadzone"] === undefined) s["gamepadDeadzone"] = 0.15;
    if (!s["keyBindings"]) {
      s["keyBindings"] = {
        pause: null, speedUp: null, speedDown: null, openLoadout: null, openResearch: null,
      };
    }
    out["settings"] = s;
    return out;
  },
};

export function migrate(raw: Record<string, unknown>): SaveSlot {
  const data = { ...raw };
  let version = typeof data["schemaVersion"] === "number" ? data["schemaVersion"] : 0;

  if (version > CURRENT_SCHEMA) {
    throw new Error(
      `Save was made with a newer build (schema v${version}, this build supports up to v${CURRENT_SCHEMA}). Update the game to load it.`,
    );
  }

  while (version < CURRENT_SCHEMA) {
    const migration = migrations[version];
    if (!migration) {
      throw new Error(`No migration registered for schema v${version} → v${version + 1}`);
    }
    Object.assign(data, migration(data));
    version += 1;
    data["schemaVersion"] = version;
  }

  return data as unknown as SaveSlot;
}
