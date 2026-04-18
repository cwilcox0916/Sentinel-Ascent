/**
 * Archive — late-game tech tree spent with Cipher Keys.
 *
 * Spec: docs/my_game/04-progression-systems.md §14.
 *
 * Three launch branches:
 *   - **Harmony** — expands Protocol Slots beyond the Archive base path
 *   - **Ward** — passive defense multipliers
 *   - **Tactician** — Boon & Scrip economy improvements
 *
 * Each branch has 3 nodes with escalating Cipher Key costs. Nodes unlock in
 * order within a branch (node 2 requires node 1, etc). Purchased nodes apply
 * their effect immediately via `applyArchive(slot)` which is called whenever
 * the slot commits — Stage.tsx already triggers recompute on run start.
 */

import type { SentinelStats } from "../sim/types.ts";
import type { SaveSlot } from "../save/schema.ts";

export type ArchiveBranchId = "harmony" | "ward" | "tactician";
export type ArchiveNodeId =
  | "harmony-1"
  | "harmony-2"
  | "harmony-3"
  | "ward-1"
  | "ward-2"
  | "ward-3"
  | "tactician-1"
  | "tactician-2"
  | "tactician-3";

export type ArchiveNode = {
  id: ArchiveNodeId;
  branch: ArchiveBranchId;
  tier: 1 | 2 | 3;
  name: string;
  description: string;
  cost: number; // Cipher Keys
  /** Optional Sentinel stat layer. */
  applyStat?: (out: SentinelStats) => void;
  /** Optional slot-level effect (e.g. expand protocol slots). Runs on purchase. */
  onPurchase?: (slot: SaveSlot) => void;
};

const NODES: ArchiveNode[] = [
  /* ---- Harmony: +Protocol Slots ---- */
  {
    id: "harmony-1",
    branch: "harmony",
    tier: 1,
    name: "Harmony I",
    description: "+1 Protocol Slot (4th slot).",
    cost: 1,
    onPurchase: (slot) => {
      if (slot.protocols.unlockedSlots < 4) {
        slot.protocols.unlockedSlots = 4;
        slot.protocols.equipped.push(null);
      }
    },
  },
  {
    id: "harmony-2",
    branch: "harmony",
    tier: 2,
    name: "Harmony II",
    description: "+1 Protocol Slot (5th slot).",
    cost: 2,
    onPurchase: (slot) => {
      if (slot.protocols.unlockedSlots < 5) {
        slot.protocols.unlockedSlots = 5;
        slot.protocols.equipped.push(null);
      }
    },
  },
  {
    id: "harmony-3",
    branch: "harmony",
    tier: 3,
    name: "Harmony III",
    description: "+1 Protocol Slot (6th slot).",
    cost: 4,
    onPurchase: (slot) => {
      if (slot.protocols.unlockedSlots < 6) {
        slot.protocols.unlockedSlots = 6;
        slot.protocols.equipped.push(null);
      }
    },
  },

  /* ---- Ward: defensive multipliers ---- */
  {
    id: "ward-1",
    branch: "ward",
    tier: 1,
    name: "Ward I",
    description: "+10% max health.",
    cost: 1,
    applyStat: (o) => { o.maxHealth *= 1.10; },
  },
  {
    id: "ward-2",
    branch: "ward",
    tier: 2,
    name: "Ward II",
    description: "+5% damage reduction.",
    cost: 2,
    applyStat: (o) => { o.defensePercent = Math.min(0.75, o.defensePercent + 0.05); },
  },
  {
    id: "ward-3",
    branch: "ward",
    tier: 3,
    name: "Ward III",
    description: "+10 Thorns, +2% Lifesteal.",
    cost: 4,
    applyStat: (o) => { o.thorns += 10; o.lifesteal = Math.min(0.5, o.lifesteal + 0.02); },
  },

  /* ---- Tactician: economy + damage ---- */
  {
    id: "tactician-1",
    branch: "tactician",
    tier: 1,
    name: "Tactician I",
    description: "+10% Scrip Bonus.",
    cost: 1,
    applyStat: (o) => { o.scripBonus += 0.10; },
  },
  {
    id: "tactician-2",
    branch: "tactician",
    tier: 2,
    name: "Tactician II",
    description: "+2 Alloy / Kill.",
    cost: 2,
    applyStat: (o) => { o.alloyPerKill += 2; },
  },
  {
    id: "tactician-3",
    branch: "tactician",
    tier: 3,
    name: "Tactician III",
    description: "+10% damage.",
    cost: 4,
    applyStat: (o) => { o.damage *= 1.10; },
  },
];

export function listArchiveNodes(): ReadonlyArray<ArchiveNode> {
  return NODES;
}

export function getArchiveNode(id: ArchiveNodeId): ArchiveNode {
  const n = NODES.find((x) => x.id === id);
  if (!n) throw new Error(`Unknown Archive node: ${id}`);
  return n;
}

export type ArchiveState = {
  unlocked: Record<ArchiveNodeId, boolean>;
};

export function createArchiveState(): ArchiveState {
  const unlocked = {} as Record<ArchiveNodeId, boolean>;
  for (const n of NODES) unlocked[n.id] = false;
  return { unlocked };
}

/** Prerequisite: previous tier in the same branch must already be unlocked. */
export function isNodeAvailable(state: ArchiveState, node: ArchiveNode): boolean {
  if (node.tier === 1) return true;
  const prevTier = node.tier - 1;
  const prereq = NODES.find((n) => n.branch === node.branch && n.tier === prevTier);
  return !!prereq && !!state.unlocked[prereq.id];
}

export function purchaseArchiveNode(
  slot: SaveSlot,
  id: ArchiveNodeId,
): "bought" | "already-owned" | "locked" | "unaffordable" {
  const state = slot.archive;
  const node = getArchiveNode(id);
  if (state.unlocked[id]) return "already-owned";
  if (!isNodeAvailable(state, node)) return "locked";
  if (slot.currencies.cipherKeys < node.cost) return "unaffordable";
  slot.currencies.cipherKeys -= node.cost;
  state.unlocked[id] = true;
  node.onPurchase?.(slot);
  return "bought";
}

/** Apply every unlocked Archive node's stat layer (called from stat pipeline). */
export function applyArchiveStats(state: ArchiveState | null, out: SentinelStats): void {
  if (!state) return;
  for (const n of NODES) {
    if (state.unlocked[n.id]) n.applyStat?.(out);
  }
}

export const ARCHIVE_BRANCHES: ReadonlyArray<{ id: ArchiveBranchId; label: string; blurb: string }> = [
  { id: "harmony", label: "Harmony", blurb: "Expand Protocol Slot capacity." },
  { id: "ward", label: "Ward", blurb: "Layered Sentinel defense." },
  { id: "tactician", label: "Tactician", blurb: "Economy + damage edge." },
];
