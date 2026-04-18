/**
 * Autosave coordinator. Subscribes to "save now" requests from the run host,
 * coalesces them with a 2-second cooldown, and notifies a save-indicator listener
 * when a write completes.
 *
 * Spec: docs/my_game/07-save-system-spec.md §7
 */

import type { SaveSlot } from "./schema.ts";
import { writeSlot } from "./repository.ts";

const COOLDOWN_MS = 2000;

export type SaveTrigger =
  | "cycleComplete"
  | "metaPurchase"
  | "runEnd"
  | "visibilityChange"
  | "manual";

export type AutosaveListener = (event: { trigger: SaveTrigger; ok: boolean; at: number }) => void;

export class Autosave {
  private listeners = new Set<AutosaveListener>();
  private getSlot: () => SaveSlot;
  private lastWriteAt = 0;
  private pendingTrigger: SaveTrigger | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(getSlot: () => SaveSlot) {
    this.getSlot = getSlot;
  }

  onSave(listener: AutosaveListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  request(trigger: SaveTrigger): void {
    const now = Date.now();
    const elapsed = now - this.lastWriteAt;
    if (elapsed >= COOLDOWN_MS) {
      void this.flush(trigger);
      return;
    }

    // Coalesce within cooldown — keep the highest-signal trigger.
    this.pendingTrigger = bestTrigger(this.pendingTrigger, trigger);
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const t = this.pendingTrigger ?? trigger;
      this.pendingTrigger = null;
      void this.flush(t);
    }, COOLDOWN_MS - elapsed);
  }

  /** Force-flush regardless of cooldown — used for runEnd / visibilityChange. */
  async flushNow(trigger: SaveTrigger = "manual"): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingTrigger = null;
    await this.flush(trigger);
  }

  private async flush(trigger: SaveTrigger): Promise<void> {
    this.lastWriteAt = Date.now();
    try {
      await writeSlot(this.getSlot());
      this.notify(trigger, true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Autosave failed:", err);
      this.notify(trigger, false);
    }
  }

  private notify(trigger: SaveTrigger, ok: boolean): void {
    const ev = { trigger, ok, at: Date.now() };
    for (const l of this.listeners) l(ev);
  }
}

const TRIGGER_PRIORITY: Record<SaveTrigger, number> = {
  manual: 0,
  cycleComplete: 1,
  metaPurchase: 1,
  visibilityChange: 2,
  runEnd: 3,
};

function bestTrigger(a: SaveTrigger | null, b: SaveTrigger): SaveTrigger {
  if (!a) return b;
  return TRIGGER_PRIORITY[b] >= TRIGGER_PRIORITY[a] ? b : a;
}
