/**
 * IndexedDB-backed save repository with crash-safe writes.
 *
 * Spec: docs/my_game/07-save-system-spec.md §4 + §8 + §9
 *
 * Layout:
 *   Database "sentinelAscent"
 *     Object Store "slots"   — keys 1..5 (canonical) and "staging:N" / "N:backupK"
 *     Object Store "global"  — last-used slot, app-wide settings
 *
 * Write protocol:
 *   1. Write to staging:N
 *   2. Atomic-swap onto N (single transaction)
 *   3. Delete staging:N
 *   4. Rotate backups (keep last 3)
 */

import { openDB, type IDBPDatabase } from "idb";
import { CURRENT_SCHEMA, type SaveSlot, type SlotId, SLOT_IDS } from "./schema.ts";
import { migrate } from "./migrations.ts";

const DB_NAME = "sentinelAscent";
const DB_VERSION = 1;
const SLOTS_STORE = "slots";
const GLOBAL_STORE = "global";
const BACKUPS_PER_SLOT = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SLOTS_STORE)) {
          db.createObjectStore(SLOTS_STORE);
        }
        if (!db.objectStoreNames.contains(GLOBAL_STORE)) {
          db.createObjectStore(GLOBAL_STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Read one slot (and migrate if it was written by an older schema). */
export async function loadSlot(slotId: SlotId): Promise<SaveSlot | null> {
  const db = await getDB();
  const raw = await db.get(SLOTS_STORE, slotId);
  if (!raw) {
    // Recovery path: was the canonical key lost mid-swap?
    const staged = await db.get(SLOTS_STORE, `staging:${slotId}`);
    if (!staged) return null;
    return migrate(staged as Record<string, unknown>);
  }
  return migrate(raw as Record<string, unknown>);
}

/** Read summaries for all 5 slots — used by the title screen picker. */
export async function loadAllSummaries(): Promise<Array<SaveSlot | null>> {
  return Promise.all(SLOT_IDS.map((id) => loadSlot(id).catch(() => null)));
}

/** Crash-safe write of a single slot. */
export async function writeSlot(slot: SaveSlot): Promise<void> {
  slot.metadata.lastSavedAt = Date.now();
  const db = await getDB();
  const tx = db.transaction(SLOTS_STORE, "readwrite");
  const store = tx.objectStore(SLOTS_STORE);

  // Stage
  await store.put(slot, `staging:${slot.slotId}`);
  // Backup rotation: shift backups before overwriting canonical.
  const previous = await store.get(slot.slotId);
  if (previous) {
    for (let k = BACKUPS_PER_SLOT; k >= 2; k--) {
      const prior = await store.get(`${slot.slotId}:backup${k - 1}`);
      if (prior) await store.put(prior, `${slot.slotId}:backup${k}`);
    }
    await store.put(previous, `${slot.slotId}:backup1`);
  }
  // Atomic swap
  await store.put(slot, slot.slotId);
  await store.delete(`staging:${slot.slotId}`);
  await tx.done;
}

/** Restore from the most recent backup if the canonical slot is unreadable. */
export async function restoreFromBackup(slotId: SlotId): Promise<SaveSlot | null> {
  const db = await getDB();
  for (let k = 1; k <= BACKUPS_PER_SLOT; k++) {
    const raw = await db.get(SLOTS_STORE, `${slotId}:backup${k}`);
    if (!raw) continue;
    try {
      return migrate(raw as Record<string, unknown>);
    } catch {
      // try next backup
    }
  }
  return null;
}

export async function deleteSlot(slotId: SlotId): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(SLOTS_STORE, "readwrite");
  const store = tx.objectStore(SLOTS_STORE);
  await store.delete(slotId);
  await store.delete(`staging:${slotId}`);
  for (let k = 1; k <= BACKUPS_PER_SLOT; k++) {
    await store.delete(`${slotId}:backup${k}`);
  }
  await tx.done;
}

export async function getLastUsedSlot(): Promise<SlotId | null> {
  const db = await getDB();
  const id = await db.get(GLOBAL_STORE, "lastSlot");
  if (typeof id === "number" && SLOT_IDS.includes(id as SlotId)) return id as SlotId;
  return null;
}

export async function setLastUsedSlot(slotId: SlotId): Promise<void> {
  const db = await getDB();
  await db.put(GLOBAL_STORE, slotId, "lastSlot");
}

/** Test-only: nuke the entire database. Used by Vitest fixtures. */
export async function _nukeForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

export const _internal = { CURRENT_SCHEMA, DB_NAME, SLOTS_STORE };
