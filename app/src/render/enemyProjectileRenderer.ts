import { Graphics } from "pixi.js";
import type { RenderLayers } from "./layers.ts";
import type { EnemyProjectile } from "../sim/types.ts";
import { PALETTE } from "./palette.ts";

/** Pooled threat-red enemy projectile graphics (Lancer fire). */
export class EnemyProjectileRenderer {
  private layers: RenderLayers;
  private graphics = new Map<number, Graphics>();

  constructor(layers: RenderLayers) {
    this.layers = layers;
  }

  update(projectiles: ReadonlyArray<EnemyProjectile>, alpha: number): void {
    const seen = new Set<number>();
    for (const p of projectiles) {
      seen.add(p.id);
      let g = this.graphics.get(p.id);
      if (!g) {
        g = new Graphics();
        g.circle(0, 0, p.radius).fill({ color: PALETTE.threat }).stroke({ color: 0xff2f79, width: 0.8, alpha: 0.8 });
        this.graphics.set(p.id, g);
        this.layers.enemies.addChild(g); // sit on enemy layer so they pass under sentinel/projectile layers
      }
      g.position.set(
        lerp(p.prevPos.x, p.pos.x, alpha),
        lerp(p.prevPos.y, p.pos.y, alpha),
      );
    }
    for (const [id, g] of this.graphics) {
      if (!seen.has(id)) {
        this.layers.enemies.removeChild(g);
        g.destroy();
        this.graphics.delete(id);
      }
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
