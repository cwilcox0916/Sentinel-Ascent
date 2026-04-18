import { Graphics } from "pixi.js";
import type { RenderLayers } from "./layers.ts";
import type { Sentinel } from "../sim/types.ts";
import { PALETTE } from "./palette.ts";

/**
 * Draws the Sentinel core + range circle.
 * Phase 1: a simple cyan octagon with an inner ring; range circle is faint.
 */
export class SentinelRenderer {
  private body = new Graphics();
  private inner = new Graphics();
  private rangeRing = new Graphics();

  constructor(layers: RenderLayers) {
    layers.indicators.addChild(this.rangeRing);
    layers.sentinel.addChild(this.body, this.inner);
  }

  update(sentinel: Sentinel): void {
    this.rangeRing.clear();
    this.rangeRing
      .circle(0, 0, sentinel.stats.range)
      .stroke({ color: PALETTE.cyan, width: 1, alpha: 0.18 });

    this.body.clear();
    this.drawOctagon(this.body, sentinel.radius);
    this.body.fill({ color: 0x0f1a2a, alpha: 0.9 }).stroke({ color: PALETTE.cyan, width: 1.6 });

    this.inner.clear();
    this.drawOctagon(this.inner, sentinel.radius * 0.55);
    this.inner.stroke({ color: PALETTE.cyan, width: 1, alpha: 0.6 });
    // tiny core dot
    this.inner.circle(0, 0, 2.5).fill({ color: PALETTE.cyan });
  }

  private drawOctagon(g: Graphics, r: number): void {
    const sides = 8;
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 8;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  }
}
