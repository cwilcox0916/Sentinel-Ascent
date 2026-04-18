# Save System Spec

This document defines the save system for `Sentinel Ascent`. The save system is part of the MVP — the build cannot ship without it.

`New` (no source-pack analog; the source pack is a live-service mobile game with cloud-bound accounts)

## 1. Goals

- **Five fully isolated save slots** so multiple players can share one device
- **Mid-run save** that resumes deterministically (same RNG, same enemy positions, same Scrip, same Cycle progress)
- **Cross-platform** save compatibility — a save exported on PC must import cleanly on tablet
- **Crash-safe** — never corrupt a save on power loss or browser crash
- **Schema-versioned** — a save written by an older version of the build must upgrade cleanly when loaded by a newer version

## 2. Storage Backend

| Platform | Backend |
|---|---|
| Web (PWA) | IndexedDB via `idb` |
| Tauri desktop | IndexedDB inside the WebView (same code path as PWA), with optional file mirror in the OS app data directory for backup |
| Browser (no install) | IndexedDB |

> Why not localStorage: 5 MB per origin is too tight for late-game saves with full history. IndexedDB has no practical cap for our needs and supports binary blobs for future-proofing (e.g., compressed snapshots).

## 3. Five Slots

`New`

There are exactly **five** slots. The player picks one on first launch, but can switch slots from the title screen at any time.

Each slot is fully isolated:

| Slot owns | Contents |
|---|---|
| Profile | Display name, avatar choice, creation timestamp, last-played timestamp |
| Currencies | Scrip, Alloy, Prisms, Cores, Insignia, Catalyst, Cipher Keys, Subnodes, Order Marks, Augment Fragments, Flux Crystals |
| Forge | Per-stat upgrade levels |
| Research Bay | Project levels, in-progress jobs (with real-time start timestamps), Auto-Procurement tier unlocks, Auto-Procurement configuration |
| Protocols | Owned Protocols + level + slotted state |
| Augments | Owned Augments with affixes + slotted state |
| Arsenals | Owned Arsenals + upgrade levels + slotted state |
| Heirlooms | Owned + level |
| Constructs | Owned + level + slotted state |
| Order | Membership, season-progress, Order Marks, weekly chest claim state |
| Warden | Unlock state, Subroutine slots, owned Subroutines + level + slotted state |
| Archive | Tech-tree purchased nodes |
| Stratum progress | High-water Cycle reach per Stratum, milestones cleared |
| Achievements | Unlocked + claim state |
| Daily Drop | Streak count, last-claim timestamp |
| Settings | Volume, low-VFX mode, input bindings, layout preferences, telemetry opt-in |
| Run snapshot | Full mid-run state if a run is in progress (see section 6) |

## 4. IndexedDB Schema

`New`

```
Database: "sentinelAscent"
  Object Store: "slots"
    Key: number (1..5)
    Value: SaveSlot
  Object Store: "global"
    Key: string
    Value: any                  # global, slot-independent settings (e.g. last-used slot)
```

```ts
type SaveSlot = {
  schemaVersion: number;        // increments on every breaking schema change
  slotId: 1 | 2 | 3 | 4 | 5;
  profile: ProfileState;
  currencies: CurrencyState;
  forge: ForgeState;
  researchBay: ResearchBayState;
  protocols: ProtocolsState;
  augments: AugmentsState;
  arsenals: ArsenalsState;
  heirlooms: HeirloomsState;
  constructs: ConstructsState;
  order: OrderState;
  warden: WardenState;
  archive: ArchiveState;
  stratumProgress: StratumProgressState;
  achievements: AchievementsState;
  dailyDrop: DailyDropState;
  settings: SettingsState;
  runSnapshot: RunSnapshot | null;
  metadata: {
    createdAt: number;          // epoch ms
    lastPlayedAt: number;
    totalPlayMs: number;
    lastSavedAt: number;
  };
};
```

## 5. Schema Versioning + Migrations

`New`

A migration registry maps `versionN → versionN+1`:

```ts
type Migration = (data: unknown) => unknown;

const migrations: Record<number, Migration> = {
  1: (v1) => { /* convert v1 → v2 */ },
  2: (v2) => { /* convert v2 → v3 */ },
  // ...
};

function loadSlot(raw: unknown): SaveSlot {
  let data = raw as { schemaVersion: number };
  while (data.schemaVersion < CURRENT_SCHEMA) {
    data = migrations[data.schemaVersion](data) as typeof data;
  }
  validate(data);
  return data as SaveSlot;
}
```

Rules:

- **Never** silently drop data during migration. Unknown fields are preserved into the next version.
- Every migration is unit-tested with a sample fixture from the previous version.
- Migrations are forward-only. The build cannot load a save with `schemaVersion > CURRENT_SCHEMA` — it shows a clear "this save was made by a newer version of the game" message.
- When a migration alters a balance value, the migration adds a one-time compensating bonus (e.g., refund spent currency if a stat is removed).

## 6. Mid-Run Snapshot

`New`

Pausing or quitting during a run writes a `RunSnapshot` into the slot. Loading the slot offers **Resume Run** before showing the Hangar.

```ts
type RunSnapshot = {
  seed: bigint;                 // serialized as string
  rngState: PRNGState;
  cycle: number;
  cycleProgressMs: number;
  scrip: number;
  stats: SentinelStats;
  enemies: SerializedEnemy[];
  projectiles: SerializedProjectile[];
  vfxObjects: SerializedVFX[];   // only persistent ones; transient hits are dropped
  arsenals: ArsenalRuntimeState[];
  autoProcurement: AutoProcurementRuntimeState;
  selectedStratum: number;
  selectedConditions: BattleCondition[];
  selectedProtocols: ProtocolEquip[];
  selectedAugments: AugmentEquip[];
  equippedArsenals: ArsenalEquip[];
  selectedSubroutines: SubroutineEquip[];
  startedAt: number;            // epoch ms
};
```

Determinism: a resumed run continues with identical RNG and enemy state. The only non-deterministic input is the player's subsequent actions; absent player input, the resumed sim produces the same future as if it had never been paused.

## 7. Auto-Save Policy

`New`

Auto-save is triggered by:

- **Cycle completion** — at the end of every Cycle, write the slot
- **Meta-progression purchase** — Forge buy, Research Bay project start/complete, Protocol equipped, Augment slotted, Arsenal upgraded, etc.
- **Run end** — final write with `runSnapshot = null`
- **Window blur / `visibilitychange = "hidden"`** — defensive write (player tabbed away or minimized)
- **Daily Drop claim**
- **Achievement unlock**
- **Manual "Save now"** menu option (mostly redundant; useful for nervous players)

Auto-save runs at most **once every 2 seconds**. Triggers within the cooldown coalesce.

The HUD shows the `.save-ind` disk icon (top-right of the top bar) which adds a `.flash` class for ~400 ms on every successful auto-save — prism color, prism glow. See [10-design-system.md](10-design-system.md) section 7 for the component spec.

## 8. Crash-Safe Write Protocol

`New`

```ts
async function writeSlot(slot: SaveSlot) {
  const tx = db.transaction("slots", "readwrite");
  const store = tx.objectStore("slots");
  // Write to a staging key first.
  await store.put(slot, `staging:${slot.slotId}`);
  // Atomic-swap onto the real key.
  await store.put(slot, slot.slotId);
  await store.delete(`staging:${slot.slotId}`);
  await tx.done;
}
```

On load:

- If `staging:${slotId}` exists but `slotId` does not, recover from staging
- If both exist, prefer the canonical key (the swap completed)
- Always validate after load; if validation fails, restore the most recent backup (see section 9)

## 9. Backup Rotation

`New`

The slot store also keeps the **last three** good versions of each slot under keys `slotId:backup1`, `slotId:backup2`, `slotId:backup3`. Each successful save rotates them.

If the load step rejects a slot's data (validation error, decode failure), the build offers to restore from the most recent backup with a clear UI dialog.

## 10. JSON Export / Import

`New`

Players can export and import save slots as `.sasave.json` files.

Export:

- Player picks a slot
- Build serializes the slot as a JSON document
- Tauri: native file save dialog (`tauri-plugin-dialog`)
- Browser: `Blob` + `<a download>` link
- Filename: `sentinel-ascent-slot{N}-{YYYYMMDD-HHMM}.sasave.json`

Import:

- Player picks a target slot (1..5)
- Build prompts for confirmation if the target slot is non-empty
- Build reads the JSON file, runs through migrations, validates, writes via the crash-safe protocol
- On validation failure, the import is rejected with a specific error pointing at the failing field

The export file includes a `gameVersion` and `schemaVersion` so cross-version imports work cleanly.

## 11. Slot Management UI

`New`

The title screen lists all five slots:

- **Slot 1 — Avatar Name** *(highest Stratum/Cycle reached, total play time, last played 2h ago)* `[Continue] [Export] [Delete]`
- **Slot 2 — empty** `[Create New]`
- ... etc

Delete flow: requires **two confirmations** ("Are you sure?", then "Type DELETE to confirm"). Deletion writes a tombstone with `deletedAt` for 7 days before actual purge — gives a buffer against accidental deletes.

## 12. Validation

`New`

Every load runs a Zod (or hand-written) validator. The validator checks:

- Currency values are non-negative integers within `Number.MAX_SAFE_INTEGER`
- Forge/Research/Augment levels are within plausible bounds
- Arrays of equipped items reference owned IDs
- The `runSnapshot` (if present) has internally consistent `cycle`, `scrip`, `enemies`, `rngState`

A validator failure does not crash the game — it falls back to backup or shows an error UI.

## 13. Settings That Live Outside Slot

`New`

Some settings are slot-independent and live in the `global` object store:

- Last-used slot ID (auto-pick on launch)
- Master volume (per-device)
- Resolution / window-size preferences
- Telemetry opt-in
- Tutorial seen flags (per-device, not per-slot — annoying to repeat tutorial on slot switch)

## 14. Test Coverage

`New`

Required Vitest coverage:

- Round-trip test: write slot → read slot → deep equal
- Crash-recovery test: write to staging only, then load → recovers
- Migration test for every `versionN → versionN+1`
- Export → import round-trip preserves all fields
- Mid-run snapshot determinism: snapshot a run at Cycle 50, resume from snapshot, run 100 ticks; same RunState as continuing without snapshotting

## 15. Open Questions For The Build Team

- Whether to allow a 6th "scratch" slot for trying experimental builds (recommend: no — five was the explicit user requirement, simpler UI)
- Whether to support cloud sync via the player's own cloud (Dropbox/Google Drive folder watch on desktop) — recommend follow-up release
- Whether deletion should be reversible from inside the game (we currently keep a 7-day tombstone but no UI surface)
- Final file extension for exports (`.sasave.json` proposed; `.json` alone is too generic)
