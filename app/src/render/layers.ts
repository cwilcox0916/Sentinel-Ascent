/**
 * PixiJS scene-graph layers. Order matches docs/my_game/01-core-runtime-and-combat-spec.md §3
 * and docs/my_game/06-architecture-and-tech-stack.md §6.
 *
 * Each layer is a top-level Container under stage. The world (0,0) origin is
 * placed at the center of the canvas via the world container's position.
 */

import { Container, type Application } from "pixi.js";

export type RenderLayers = {
  /** Master container that translates world (0,0) to canvas center and scales to fit. */
  world: Container;
  background: Container;
  indicators: Container;
  fields: Container;
  enemies: Container;
  sentinel: Container;
  projectiles: Container;
  popups: Container;
};

/**
 * Visible-radius target for the fit-to-stage scaling.
 *
 * The simulation uses fixed world units (Sentinel range = 280, spawn ring = 480).
 * On smaller viewports we scale the world container so this radius is always
 * visible from the Sentinel — players see enemies before they're already inside
 * the engagement zone. PC viewports clamp to 1.0× so the look stays at native size.
 *
 * 380 ≈ Sentinel range (280) × 1.35 — a comfortable band of "approaching" space
 * around the engagement zone without forcing the spawn ring (480) all the way in.
 */
const TARGET_VISIBLE_RADIUS = 380;

/** Don't shrink past this — preserves Sentinel/projectile readability on small tablets. */
const MIN_SCALE = 0.45;

/** Don't enlarge past this — prevents PC ultrawide from making everything huge. */
const MAX_SCALE = 1.0;

export function createLayers(app: Application): RenderLayers {
  const world = new Container();
  app.stage.addChild(world);

  const background = new Container();
  const indicators = new Container();
  const fields = new Container();
  const enemies = new Container();
  const sentinel = new Container();
  const projectiles = new Container();
  const popups = new Container();

  world.addChild(background, indicators, fields, enemies, sentinel, projectiles, popups);
  fitWorld(app, world);

  return { world, background, indicators, fields, enemies, sentinel, projectiles, popups };
}

/**
 * Center the world at the canvas's CSS center and scale so a TARGET_VISIBLE_RADIUS
 * radius around the Sentinel always fits within the shorter stage dimension.
 *
 * The world coordinate system is CSS pixels (autoDensity:true); `clientWidth/Height`
 * gives the on-screen size. The simulation is never rescaled — only the renderer.
 */
export function fitWorld(app: Application, world: Container): void {
  const canvas = app.canvas as HTMLCanvasElement;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;

  const minHalfDim = Math.min(w, h) / 2;
  const rawScale = minHalfDim / TARGET_VISIBLE_RADIUS;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));

  world.scale.set(scale);
  world.position.set(w / 2, h / 2);
}

/** Backwards-compat alias — old call sites that just want centering. */
export const centerWorld = fitWorld;
