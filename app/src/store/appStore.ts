/**
 * App-level routing state. Phase 3: title (slot picker) → in-game.
 */

import { create } from "zustand";
import type { SaveSlot } from "../save/schema.ts";

export type Route = "main-menu" | "title" | "hangar" | "in-game";
export type Overlay = "none" | "research" | "loadout";

type Store = {
  route: Route;
  overlay: Overlay;
  activeSlot: SaveSlot | null;
  /** Rail pulse fires when a research project completes while the bay is closed. */
  railGlow: boolean;
  /** Bumped on Retry to force Stage remount with fresh sim + renderer. */
  runEpoch: number;
  setRoute: (route: Route) => void;
  setOverlay: (overlay: Overlay) => void;
  setActiveSlot: (slot: SaveSlot | null) => void;
  setRailGlow: (on: boolean) => void;
  bumpRunEpoch: () => void;
};

export const useAppStore = create<Store>((set, get) => ({
  route: "main-menu",
  overlay: "none",
  activeSlot: null,
  railGlow: false,
  runEpoch: 0,
  setRoute: (route) => set({ route }),
  setOverlay: (overlay) => set({ overlay }),
  setActiveSlot: (slot) => set({ activeSlot: slot }),
  setRailGlow: (railGlow) => set({ railGlow }),
  bumpRunEpoch: () => set({ runEpoch: get().runEpoch + 1 }),
}));
