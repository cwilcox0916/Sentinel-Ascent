/**
 * Owns the PixiJS Application + the per-tick → per-frame render bridge.
 *
 * - Sim runs at fixed 60 Hz inside its own logical clock
 * - Render runs at display refresh, interpolating between the last two ticks
 *   via `alpha` in [0, 1]
 *
 * See docs/my_game/06-architecture-and-tech-stack.md §4.
 */

import { Application } from "pixi.js";
import type { RunState } from "../sim/types.ts";
import { simulateTick, TICK_DT } from "../sim/tick.ts";
import { createLayers, centerWorld, type RenderLayers } from "./layers.ts";
import { SentinelRenderer } from "./sentinelRenderer.ts";
import { EnemyRenderer } from "./enemyRenderer.ts";
import { ProjectileRenderer } from "./projectileRenderer.ts";
import { EnemyProjectileRenderer } from "./enemyProjectileRenderer.ts";

export type RunRendererState = "starting" | "running" | "destroyed";

export class RunRenderer {
  private app = new Application();
  private layers!: RenderLayers;
  private sentinelRenderer!: SentinelRenderer;
  private enemyRenderer!: EnemyRenderer;
  private projectileRenderer!: ProjectileRenderer;
  private enemyProjectileRenderer!: EnemyProjectileRenderer;

  private accumulator = 0;
  private lastFrameTime = 0;
  private rafHandle = 0;
  private state: RunRendererState = "starting";
  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler = (): void => this.recenter();

  /** Attach to a canvas element and start the loop. */
  async start(canvas: HTMLCanvasElement, run: RunState): Promise<void> {
    const parent = canvas.parentElement ?? undefined;
    await this.app.init({
      canvas,
      resizeTo: parent,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    });
    if ((this.state as RunRendererState) === "destroyed") {
      this.app.destroy(true, { children: true });
      return;
    }
    this.layers = createLayers(this.app);
    this.sentinelRenderer = new SentinelRenderer(this.layers);
    this.enemyRenderer = new EnemyRenderer(this.layers);
    this.projectileRenderer = new ProjectileRenderer(this.layers);
    this.enemyProjectileRenderer = new EnemyProjectileRenderer(this.layers);

    // Window resize covers actual window changes; ResizeObserver covers CSS-driven
    // layout reflows (e.g. our 1280px breakpoint swap from PC shell to tablet).
    window.addEventListener("resize", this.resizeHandler);
    if (parent && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.recenter());
      this.resizeObserver.observe(parent);
    }

    this.lastFrameTime = performance.now();
    this.state = "running";
    const loop = (now: number): void => {
      if ((this.state as RunRendererState) === "destroyed") return;
      this.frame(now, run);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  destroy(): void {
    this.state = "destroyed";
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    window.removeEventListener("resize", this.resizeHandler);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    try {
      this.app.destroy(true, { children: true });
    } catch {
      /* ignore */
    }
  }

  private recenter(): void {
    if (!this.layers) return;
    centerWorld(this.app, this.layers.world);
  }

  private frame(now: number, run: RunState): void {
    const dtMs = Math.min(now - this.lastFrameTime, 250); // clamp tab-blur catchup
    this.lastFrameTime = now;
    this.accumulator += dtMs / 1000;

    while (this.accumulator >= TICK_DT) {
      simulateTick(run);
      this.accumulator -= TICK_DT;
    }
    const alpha = this.accumulator / TICK_DT;

    // Belt-and-suspenders: ResizeObserver should catch every layout change, but
    // recentering per frame is one Container.position write — cheaper than diagnosing
    // a stale position the next time the shell breakpoint swaps.
    this.recenter();

    this.sentinelRenderer.update(run.sentinel);
    this.enemyRenderer.update(run.enemies, alpha);
    this.enemyProjectileRenderer.update(run.enemyProjectiles, alpha);
    this.projectileRenderer.update(run.projectiles, alpha);
  }
}
