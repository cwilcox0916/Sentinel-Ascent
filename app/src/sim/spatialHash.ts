/**
 * Spatial hash — grid-indexed broadphase for enemy lookups.
 *
 * Spec: docs/my_game/11-build-roadmap.md Phase 15 ("spatial hashing for enemy lookups").
 *
 * At high Cycles we have hundreds of enemies, and every Sentinel shot + every
 * projectile hit resolution previously did an O(N) scan. This hash partitions
 * the Grid into square cells so nearest-target + in-radius queries touch only
 * the cells the query overlaps.
 *
 * Rebuilt once per tick at the top of `simulateTick` via `rebuildEnemyHash`.
 * Membership is keyed by enemy id so a moving enemy doesn't require remove/insert
 * during the tick — we just rebuild next tick.
 */

import type { Enemy } from "./types.ts";

/** Cell size in world units. Empirically balances: larger = fewer cells visited
 *  per query, but more enemies per cell. 80 is roughly 2× Hulk radius. */
export const HASH_CELL_SIZE = 80;

export class EnemySpatialHash {
  private readonly cellSize: number;
  private cells: Map<number, Enemy[]> = new Map();

  constructor(cellSize: number = HASH_CELL_SIZE) {
    this.cellSize = cellSize;
  }

  rebuild(enemies: Enemy[]): void {
    this.cells.clear();
    for (const e of enemies) {
      if (e.state === "dying") continue;
      const key = this.hash(e.pos.x, e.pos.y);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = [];
        this.cells.set(key, bucket);
      }
      bucket.push(e);
    }
  }

  /** Enemies in any cell touched by a circle of `radius` around (cx, cy). */
  queryRadius(cx: number, cy: number, radius: number, out: Enemy[]): Enemy[] {
    out.length = 0;
    const r = radius;
    const minCx = Math.floor((cx - r) / this.cellSize);
    const maxCx = Math.floor((cx + r) / this.cellSize);
    const minCy = Math.floor((cy - r) / this.cellSize);
    const maxCy = Math.floor((cy + r) / this.cellSize);
    const rSq = r * r;
    for (let gx = minCx; gx <= maxCx; gx++) {
      for (let gy = minCy; gy <= maxCy; gy++) {
        const bucket = this.cells.get(gx * 73856093 ^ gy * 19349663);
        if (!bucket) continue;
        for (const e of bucket) {
          const dx = e.pos.x - cx;
          const dy = e.pos.y - cy;
          if (dx * dx + dy * dy <= rSq) out.push(e);
        }
      }
    }
    return out;
  }

  /**
   * Nearest enemy to (cx, cy) within maxRadius, or null. Uses an expanding-ring
   * search so we can early-exit the moment we find a candidate in the innermost
   * occupied ring.
   */
  queryNearest(cx: number, cy: number, maxRadius: number): Enemy | null {
    const maxRingsOut = Math.ceil(maxRadius / this.cellSize);
    const baseGx = Math.floor(cx / this.cellSize);
    const baseGy = Math.floor(cy / this.cellSize);
    const maxRadiusSq = maxRadius * maxRadius;
    let best: Enemy | null = null;
    let bestDistSq = Infinity;
    for (let ring = 0; ring <= maxRingsOut; ring++) {
      // Scan the ring-shaped cell band.
      const lo = -ring;
      const hi = ring;
      for (let gx = lo; gx <= hi; gx++) {
        for (let gy = lo; gy <= hi; gy++) {
          if (ring > 0 && Math.abs(gx) !== ring && Math.abs(gy) !== ring) continue;
          const key = (baseGx + gx) * 73856093 ^ (baseGy + gy) * 19349663;
          const bucket = this.cells.get(key);
          if (!bucket) continue;
          for (const e of bucket) {
            const dx = e.pos.x - cx;
            const dy = e.pos.y - cy;
            const d = dx * dx + dy * dy;
            if (d < bestDistSq && d <= maxRadiusSq) {
              bestDistSq = d;
              best = e;
            }
          }
        }
      }
      // Can't beat `best` from further rings if best is inside this ring's worst-case distance.
      if (best) {
        const minNextRingDist = ring * this.cellSize;
        if (bestDistSq <= minNextRingDist * minNextRingDist) break;
      }
    }
    return best;
  }

  private hash(x: number, y: number): number {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    return gx * 73856093 ^ gy * 19349663;
  }
}

/** Called once per simulation tick. */
export function rebuildEnemyHash(hash: EnemySpatialHash, enemies: Enemy[]): void {
  hash.rebuild(enemies);
}
