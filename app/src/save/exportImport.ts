/**
 * JSON export / import for save slots.
 *
 * Spec: docs/my_game/07-save-system-spec.md §10
 *
 * File format: a JSON document with `gameVersion` + `schemaVersion` plus the
 * full SaveSlot. On import, the same migration pipeline runs, so cross-version
 * imports work as long as the source schemaVersion ≤ CURRENT_SCHEMA.
 */

import type { SaveSlot, SlotId } from "./schema.ts";
import { CURRENT_SCHEMA } from "./schema.ts";
import { migrate } from "./migrations.ts";

export const GAME_VERSION = "0.1.0";
export const FILE_EXT = "sasave.json";

export type ExportEnvelope = {
  game: "sentinel-ascent";
  gameVersion: string;
  schemaVersion: number;
  exportedAt: number;
  slot: SaveSlot;
};

export function serializeSlotToJSON(slot: SaveSlot): string {
  const env: ExportEnvelope = {
    game: "sentinel-ascent",
    gameVersion: GAME_VERSION,
    schemaVersion: CURRENT_SCHEMA,
    exportedAt: Date.now(),
    slot,
  };
  return JSON.stringify(env, null, 2);
}

export function parseSlotFromJSON(text: string, targetSlotId: SlotId): SaveSlot {
  const env = JSON.parse(text) as Partial<ExportEnvelope>;
  if (env.game !== "sentinel-ascent") {
    throw new Error("File is not a Sentinel Ascent save");
  }
  if (!env.slot) throw new Error("File is missing slot data");

  const migrated = migrate(env.slot as unknown as Record<string, unknown>);
  // Force the slot to land in the user's chosen target.
  migrated.slotId = targetSlotId;
  return migrated;
}

/**
 * Trigger a browser file download. Tauri builds will route through the native
 * file dialog instead — that wiring lands in Phase 16 (Tauri distribution).
 */
export function downloadSlotAsFile(slot: SaveSlot): void {
  if (typeof document === "undefined") return; // SSR/test no-op
  const json = serializeSlotToJSON(slot);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  a.download = `sentinel-ascent-slot${slot.slotId}-${stamp}.${FILE_EXT}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Read a user-picked File and parse it. */
export async function readSlotFromFile(file: File, targetSlotId: SlotId): Promise<SaveSlot> {
  const text = await file.text();
  return parseSlotFromJSON(text, targetSlotId);
}
