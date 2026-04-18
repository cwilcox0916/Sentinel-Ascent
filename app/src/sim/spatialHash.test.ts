import { describe, it, expect } from "vitest";
import { EnemySpatialHash } from "./spatialHash.ts";
import type { Enemy } from "./types.ts";

function mkEnemy(id: number, x: number, y: number): Enemy {
  return {
    id,
    archetype: "drone",
    pos: { x, y },
    prevPos: { x, y },
    vel: { x: 0, y: 0 },
    hp: 10,
    maxHp: 10,
    radius: 4,
    speed: 0,
    contactDamage: 0,
    alloyReward: 0,
    state: "approaching",
    spawnedAtCycle: 1,
    attackCooldown: 0,
  };
}

describe("EnemySpatialHash", () => {
  it("queryRadius returns only enemies inside the radius", () => {
    const hash = new EnemySpatialHash();
    const enemies = [
      mkEnemy(1, 0, 0),
      mkEnemy(2, 40, 0),
      mkEnemy(3, 400, 400),
    ];
    hash.rebuild(enemies);
    const out: Enemy[] = [];
    hash.queryRadius(0, 0, 50, out);
    const ids = out.map((e) => e.id).sort();
    expect(ids).toEqual([1, 2]);
  });

  it("queryRadius excludes dying enemies", () => {
    const hash = new EnemySpatialHash();
    const a = mkEnemy(1, 0, 0);
    a.state = "dying";
    hash.rebuild([a]);
    const out: Enemy[] = [];
    hash.queryRadius(0, 0, 100, out);
    expect(out.length).toBe(0);
  });

  it("queryNearest finds the closest within maxRadius", () => {
    const hash = new EnemySpatialHash();
    hash.rebuild([
      mkEnemy(1, 100, 0),
      mkEnemy(2, 50, 0),
      mkEnemy(3, 300, 0),
    ]);
    const nearest = hash.queryNearest(0, 0, 200);
    expect(nearest?.id).toBe(2);
  });

  it("queryNearest returns null when nothing inside maxRadius", () => {
    const hash = new EnemySpatialHash();
    hash.rebuild([mkEnemy(1, 500, 0)]);
    expect(hash.queryNearest(0, 0, 200)).toBeNull();
  });

  it("rebuild clears previous cell contents", () => {
    const hash = new EnemySpatialHash();
    hash.rebuild([mkEnemy(1, 0, 0)]);
    hash.rebuild([mkEnemy(2, 40, 0)]);
    const nearest = hash.queryNearest(0, 0, 100);
    expect(nearest?.id).toBe(2);
  });
});
