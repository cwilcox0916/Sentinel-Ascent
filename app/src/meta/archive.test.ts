import { describe, it, expect } from "vitest";
import {
  createArchiveState,
  isNodeAvailable,
  listArchiveNodes,
  purchaseArchiveNode,
  applyArchiveStats,
  getArchiveNode,
} from "./archive.ts";
import { createEmptySlot } from "../save/schema.ts";
import { DEFAULT_SENTINEL_STATS } from "../sim/runState.ts";

describe("Archive", () => {
  it("ships 9 nodes across 3 branches", () => {
    expect(listArchiveNodes().length).toBe(9);
  });

  it("tier-1 nodes are always available, tier-2 requires tier-1", () => {
    const state = createArchiveState();
    const t1 = getArchiveNode("harmony-1");
    const t2 = getArchiveNode("harmony-2");
    expect(isNodeAvailable(state, t1)).toBe(true);
    expect(isNodeAvailable(state, t2)).toBe(false);
    state.unlocked["harmony-1"] = true;
    expect(isNodeAvailable(state, t2)).toBe(true);
  });

  it("purchase requires Cipher Keys", () => {
    const slot = createEmptySlot(1, "t");
    expect(purchaseArchiveNode(slot, "harmony-1")).toBe("unaffordable");
    slot.currencies.cipherKeys = 10;
    expect(purchaseArchiveNode(slot, "harmony-1")).toBe("bought");
    expect(slot.currencies.cipherKeys).toBe(9);
    expect(slot.archive.unlocked["harmony-1"]).toBe(true);
  });

  it("Harmony-1 expands Protocol slots to 4", () => {
    const slot = createEmptySlot(1, "t");
    slot.currencies.cipherKeys = 10;
    expect(slot.protocols.unlockedSlots).toBe(3);
    purchaseArchiveNode(slot, "harmony-1");
    expect(slot.protocols.unlockedSlots).toBe(4);
    expect(slot.protocols.equipped.length).toBe(4);
  });

  it("tier-2 locked until tier-1 unlocked", () => {
    const slot = createEmptySlot(1, "t");
    slot.currencies.cipherKeys = 10;
    expect(purchaseArchiveNode(slot, "harmony-2")).toBe("locked");
  });

  it("applyArchiveStats composes unlocked node effects", () => {
    const slot = createEmptySlot(1, "t");
    slot.currencies.cipherKeys = 10;
    purchaseArchiveNode(slot, "ward-1"); // +10% HP
    const stats = { ...DEFAULT_SENTINEL_STATS };
    applyArchiveStats(slot.archive, stats);
    expect(stats.maxHealth).toBeCloseTo(DEFAULT_SENTINEL_STATS.maxHealth * 1.1);
  });

  it("cannot re-purchase an owned node", () => {
    const slot = createEmptySlot(1, "t");
    slot.currencies.cipherKeys = 10;
    purchaseArchiveNode(slot, "ward-1");
    expect(purchaseArchiveNode(slot, "ward-1")).toBe("already-owned");
  });
});
