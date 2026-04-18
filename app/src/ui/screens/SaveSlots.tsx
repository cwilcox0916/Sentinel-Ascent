import { useEffect, useState, useRef } from "react";
import {
  createEmptySlot,
  type SaveSlot,
  type SlotId,
  SLOT_IDS,
  summarizeSlot,
  type SaveSlotSummary,
} from "../../save/schema.ts";
import {
  deleteSlot as repoDeleteSlot,
  loadAllSummaries,
  setLastUsedSlot,
  writeSlot,
} from "../../save/repository.ts";
import { downloadSlotAsFile, readSlotFromFile } from "../../save/exportImport.ts";
import { useAppStore } from "../../store/appStore.ts";
import { applySettingsSideEffects } from "./Settings.tsx";

/**
 * Title-screen 5-slot picker. Spec: docs/my_game/07-save-system-spec.md §11
 */
export function SaveSlots() {
  const [slots, setSlots] = useState<Array<SaveSlot | null>>([null, null, null, null, null]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importTargetSlot, setImportTargetSlot] = useState<SlotId | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  // Esc → back to Main Menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") useAppStore.getState().setRoute("main-menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function refresh(): Promise<void> {
    setLoading(true);
    const all = await loadAllSummaries();
    setSlots(all);
    setLoading(false);
  }

  async function handleStart(slotId: SlotId, existing: SaveSlot | null): Promise<void> {
    let slot = existing;
    if (!slot) {
      slot = createEmptySlot(slotId, `Operator ${slotId}`);
      await writeSlot(slot);
    }
    await setLastUsedSlot(slotId);
    applySettingsSideEffects(slot.settings);
    useAppStore.getState().setActiveSlot(slot);
    useAppStore.getState().setRoute("hangar");
  }

  async function handleDelete(slotId: SlotId): Promise<void> {
    if (!confirm(`Delete Slot ${slotId} permanently? This cannot be undone.`)) return;
    const second = prompt("Type DELETE to confirm:");
    if (second?.trim().toUpperCase() !== "DELETE") return;
    await repoDeleteSlot(slotId);
    await refresh();
  }

  function handleExport(slot: SaveSlot): void {
    downloadSlotAsFile(slot);
  }

  function triggerImport(slotId: SlotId): void {
    setImportTargetSlot(slotId);
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File): Promise<void> {
    if (!importTargetSlot) return;
    try {
      const slot = await readSlotFromFile(file, importTargetSlot);
      await writeSlot(slot);
      await refresh();
      alert(`Imported into Slot ${importTargetSlot}.`);
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`);
    } finally {
      setImportTargetSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="title-screen">
      <header className="title-head">
        <div className="brand">
          <div className="logo logo-img">
            <img src="/icon-128.png" alt="Sentinel Ascent" />
          </div>
          <div>
            <div className="name">Sentinel Ascent</div>
            <div className="tag">Select Operator Profile</div>
          </div>
        </div>
        <div className="title-head-actions">
          <button
            className="pill"
            onClick={() => useAppStore.getState().setRoute("main-menu")}
          >
            ↩ Main Menu · Esc
          </button>
        </div>
      </header>

      <div className="slots-list">
        {SLOT_IDS.map((slotId, idx) => {
          const slot = slots[idx] ?? null;
          const summary = summarizeSlot(slot, slotId);
          return (
            <SlotRow
              key={slotId}
              slotId={slotId}
              summary={summary}
              loading={loading}
              onStart={() => void handleStart(slotId, slot)}
              onDelete={() => void handleDelete(slotId)}
              onExport={() => slot && handleExport(slot)}
              onImport={() => triggerImport(slotId)}
            />
          );
        })}
      </div>

      <footer className="title-foot mono">
        Saves are stored locally · Export to back up · No account required
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.sasave.json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />
    </div>
  );
}

function SlotRow(props: {
  slotId: SlotId;
  summary: SaveSlotSummary;
  loading: boolean;
  onStart: () => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const { slotId, summary, loading, onStart, onDelete, onExport, onImport } = props;
  return (
    <div className={`slot-row${summary.occupied ? " occupied" : " empty"}`}>
      <div className="slot-id mono">{String(slotId).padStart(2, "0")}</div>
      <div className="slot-meta">
        {loading ? (
          <div className="slot-name mono" style={{ color: "var(--fg-mute)" }}>Loading…</div>
        ) : summary.occupied ? (
          <>
            <div className="slot-name">{summary.displayName}</div>
            <div className="slot-detail mono">
              <span>Cycle {summary.highestCycle}</span>
              <span>·</span>
              <span>{formatDuration(summary.totalPlayMs ?? 0)} played</span>
              {summary.hasRunInProgress && (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--cyan)" }}>RUN IN PROGRESS</span>
                </>
              )}
              <span>·</span>
              <span>{formatRelative(summary.lastPlayedAt ?? 0)}</span>
            </div>
          </>
        ) : (
          <div className="slot-name mono" style={{ color: "var(--fg-mute)" }}>Empty slot</div>
        )}
      </div>
      <div className="slot-actions">
        {summary.occupied ? (
          <>
            <button className="pill active" onClick={onStart}>
              {summary.hasRunInProgress ? "Resume" : "Continue"}
            </button>
            <button className="pill" onClick={onExport}>Export</button>
            <button className="pill" onClick={onImport}>Import</button>
            <button className="pill danger" onClick={onDelete}>Delete</button>
          </>
        ) : (
          <>
            <button className="pill active" onClick={onStart}>New Game</button>
            <button className="pill" onClick={onImport}>Import</button>
          </>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const remainder = min - hr * 60;
  return `${hr}h ${remainder}m`;
}

function formatRelative(epochMs: number): string {
  if (!epochMs) return "—";
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
