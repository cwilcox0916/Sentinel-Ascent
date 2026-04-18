/**
 * Save-indicator state — pulses on every successful autosave.
 * Driven by the Autosave coordinator; consumed by the TopBar's .save-ind.
 */

import { create } from "zustand";

type Store = {
  saveFlash: boolean;
  flash: () => void;
};

export const useSaveStore = create<Store>((set) => ({
  saveFlash: false,
  flash: () => {
    set({ saveFlash: true });
    setTimeout(() => set({ saveFlash: false }), 600);
  },
}));
