import { Graphics } from "pixi.js";
import type { RenderLayers } from "./layers.ts";
import type { Enemy, EnemyArchetype } from "../sim/types.ts";
import { PALETTE } from "./palette.ts";

/**
 * Pooled enemy graphics. Each Enemy.id maps to one Graphics object reused across frames.
 * Phase 5 ships per-archetype silhouettes per docs/my_game/03-visual-style §4.
 */
export class EnemyRenderer {
  private layers: RenderLayers;
  private graphics = new Map<number, Graphics>();
  private hpBars = new Map<number, Graphics>();

  constructor(layers: RenderLayers) {
    this.layers = layers;
  }

  /** Render with interpolation between sim ticks. */
  update(enemies: ReadonlyArray<Enemy>, alpha: number): void {
    const seen = new Set<number>();

    for (const enemy of enemies) {
      seen.add(enemy.id);
      let g = this.graphics.get(enemy.id);
      if (!g) {
        g = makeArchetypeGraphic(enemy.archetype, enemy.radius);
        this.graphics.set(enemy.id, g);
        this.layers.enemies.addChild(g);
      }
      const x = lerp(enemy.prevPos.x, enemy.pos.x, alpha);
      const y = lerp(enemy.prevPos.y, enemy.pos.y, alpha);
      g.position.set(x, y);

      // Behemoth gets a small inline HP bar in addition to the dedicated top-center bar.
      if (enemy.archetype === "behemoth") {
        let bar = this.hpBars.get(enemy.id);
        if (!bar) {
          bar = new Graphics();
          this.hpBars.set(enemy.id, bar);
          this.layers.enemies.addChild(bar);
        }
        bar.clear();
        const w = enemy.radius * 2.4;
        const h = 3;
        const pct = Math.max(0, enemy.hp / enemy.maxHp);
        bar.rect(-w / 2, -enemy.radius - 8, w, h).fill({ color: 0x1a0710 });
        bar.rect(-w / 2, -enemy.radius - 8, w * pct, h).fill({ color: PALETTE.threat });
        bar.position.set(x, y);
      }
    }

    // Reap stale graphics (enemy died this tick).
    for (const [id, g] of this.graphics) {
      if (!seen.has(id)) {
        this.layers.enemies.removeChild(g);
        g.destroy();
        this.graphics.delete(id);
      }
    }
    for (const [id, bar] of this.hpBars) {
      if (!seen.has(id)) {
        this.layers.enemies.removeChild(bar);
        bar.destroy();
        this.hpBars.delete(id);
      }
    }
  }
}

function makeArchetypeGraphic(archetype: EnemyArchetype, radius: number): Graphics {
  const g = new Graphics();
  switch (archetype) {
    case "drone":
      drawDiamond(g, radius, PALETTE.threat);
      break;
    case "skimmer":
      drawArrow(g, radius, PALETTE.threat);
      break;
    case "hulk":
      drawHexagon(g, radius * 1.1, 0xff9a4a);
      break;
    case "lancer":
      drawTriangle(g, radius, 0xff7a4a);
      break;
    case "behemoth":
      drawBehemoth(g, radius);
      break;
    default:
      drawDiamond(g, radius, PALETTE.threat);
  }
  return g;
}

function drawDiamond(g: Graphics, r: number, color: number): void {
  g.moveTo(0, -r).lineTo(r, 0).lineTo(0, r).lineTo(-r, 0).closePath();
  g.fill({ color, alpha: 0.85 }).stroke({ color: 0xffd0d8, width: 1, alpha: 0.6 });
}

function drawArrow(g: Graphics, r: number, color: number): void {
  // Slim forward-pointing arrow; orientation is implied by movement.
  g.moveTo(r * 1.4, 0).lineTo(-r * 0.6, r * 0.8).lineTo(-r * 0.2, 0).lineTo(-r * 0.6, -r * 0.8).closePath();
  g.fill({ color, alpha: 0.9 }).stroke({ color: 0xffe0e0, width: 1, alpha: 0.7 });
}

function drawHexagon(g: Graphics, r: number, color: number): void {
  const sides = 6;
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.fill({ color, alpha: 0.85 }).stroke({ color: 0xffe5b8, width: 1.4, alpha: 0.7 });
}

function drawTriangle(g: Graphics, r: number, color: number): void {
  g.moveTo(0, -r).lineTo(r * 0.95, r * 0.7).lineTo(-r * 0.95, r * 0.7).closePath();
  g.fill({ color, alpha: 0.85 }).stroke({ color: 0xffd9b8, width: 1, alpha: 0.7 });
}

function drawBehemoth(g: Graphics, r: number): void {
  // Oversized polygon with a thick threat-red outline + inner ring.
  const sides = 8;
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 8;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.fill({ color: 0x350712, alpha: 0.92 }).stroke({ color: PALETTE.threat, width: 2.2 });
  g.circle(0, 0, r * 0.55).stroke({ color: 0xff2f79, width: 1.5, alpha: 0.6 });
  g.circle(0, 0, 4).fill({ color: 0xff2f79 });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
