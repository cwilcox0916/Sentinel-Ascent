import { useEffect, useState } from "react";
import { ResearchBay } from "./screens/ResearchBay.tsx";
import { useAppStore } from "../store/appStore.ts";
import { useRunStore } from "../store/runStore.ts";
import {
  queueAfter as queueAfterAction,
  queueProject,
  cancelQueued,
  type ProjectId,
} from "../meta/researchBay.ts";
import { writeSlot } from "../save/repository.ts";

/**
 * Host component for the Research Bay overlay. Runs the queue-action bridge
 * between the UI and the live slot, keeps currency/stratum state in sync,
 * and re-reads the slot every second so the slot progress bars tick.
 */
export function ResearchBayHost() {
  const overlay = useAppStore((s) => s.overlay);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const activeSlot = useAppStore((s) => s.activeSlot);
  const cycle = useRunStore((s) => s.summary.cycle);

  // Force periodic re-render while open so countdowns update.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (overlay !== "research") return;
    const t = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [overlay]);

  if (overlay !== "research" || !activeSlot) return null;

  const bay = activeSlot.researchBay;
  const currencies = {
    alloy: activeSlot.currencies.alloy,
    catalyst: activeSlot.currencies.catalyst,
    prisms: activeSlot.currencies.prisms,
  };

  // Phase 6 stub: Hangar in Phase 7 will supply the real Stratum. Until then,
  // treat the player as having cleared every Stratum so all projects are queueable.
  const PHASE_6_STRATUM_STUB = 20;

  async function handleQueue(id: ProjectId): Promise<void> {
    if (!activeSlot) return;
    const now = Date.now();
    const result = queueProject(
      activeSlot.researchBay,
      currencies,
      PHASE_6_STRATUM_STUB,
      id,
      now,
    );
    if (result.ok) {
      activeSlot.currencies.alloy -= result.alloySpent ?? 0;
      activeSlot.currencies.catalyst -= result.catalystSpent ?? 0;
      await writeSlot(activeSlot);
      setTick((n) => n + 1);
    }
  }

  async function handleQueueAfter(slotIndex: number, id: ProjectId): Promise<void> {
    if (!activeSlot) return;
    queueAfterAction(activeSlot.researchBay, slotIndex, id, Date.now());
    await writeSlot(activeSlot);
    setTick((n) => n + 1);
  }

  async function handleCancelQueued(slotIndex: number): Promise<void> {
    if (!activeSlot) return;
    cancelQueued(activeSlot.researchBay, slotIndex);
    await writeSlot(activeSlot);
    setTick((n) => n + 1);
  }

  return (
    <ResearchBay
      bay={bay}
      currencies={currencies}
      stratum={/* Phase 6 stub — Hangar in Phase 7 surfaces real Stratum */ 20}
      currentCycle={cycle}
      onQueue={(id) => void handleQueue(id)}
      onQueueAfter={(idx, id) => void handleQueueAfter(idx, id)}
      onCancelQueued={(idx) => void handleCancelQueued(idx)}
      onClose={() => setOverlay("none")}
    />
  );
}
