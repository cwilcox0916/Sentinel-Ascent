# Architecture And Tech Stack

This document defines the implementation stack and the high-level code architecture for `Sentinel Ascent`. The build target is **PC (desktop, mouse + keyboard + gamepad) and tablet (touch)** from a single codebase, with no game engine.

## 1. Stack Decisions

`New` (decisions specific to Sentinel Ascent)

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** (strict) | Single language across sim, render, UI, tooling. Strong typing matters for a wide stat surface. |
| Build | **Vite** | Fast dev cycle; trivial PWA plugin support. |
| Renderer | **PixiJS v8** | 2D library (not an engine). WebGL/WebGPU. Handles thousands of particles cleanly. The neon-cyber visual style is its sweet spot. |
| State store | Zustand (or hand-rolled signal store) | Reactive HUD ↔ sim binding without a UI framework dependency. |
| UI | Plain DOM + a thin React mount for the HUD | React only for HUD/menus; the Grid is pure PixiJS. |
| **Design system** | **CSS custom properties + plain CSS modules** | Tokens and component selectors locked in [10-design-system.md](10-design-system.md). No Tailwind, no styled-components — the prototype's tokens transfer 1:1 into `src/styles/tokens.css`. |
| Fonts | **Inter** + **JetBrains Mono** (Google Fonts, self-hostable) | Two fonts only; mono is required for tabular numbers throughout the HUD. |
| Audio | **Howler.js** | Cross-platform, sane mobile autoplay handling. |
| Persistence | **IndexedDB** via `idb` | Per-save namespaced; binary-safe; larger quota than localStorage. JSON export/import for backup. |
| Desktop packaging | **Tauri 2** | Rust shell, ~10 MB output, native menus, FS access for save export, Steam-friendly. |
| Tablet | **PWA** (installable from browser) | One codebase. Touch input layer feeds the same input bus. |
| RNG | **xoroshiro128+** | Deterministic, fast, seedable, serializable state. |
| Tests | **Vitest** (unit) + **Playwright** (smoke) | Vitest for sim/economy logic; Playwright for cold-start and a Cycle-100 smoke run. |

> **Why no engine.** The user explicitly excluded engines like Godot/Unreal. PixiJS is a rendering library (no scene graph beyond a basic display tree, no built-in physics, no asset pipeline beyond loaders). Sentinel Ascent does not need scene management, physics simulation, 3D, or visual editors.

## 2. Why Web For Both PC And Tablet

`Inferred`

A web stack is the only path that gives PC + tablet from one codebase without an engine:

- **PC**: Tauri wraps the same web build into a native window with file system access, system tray, and OS-level menus
- **Tablet**: PWA installation from Safari/Chrome, full-screen, offline-capable via Service Worker
- Optional fallback: pure browser play at the same URL — no install required

This keeps QA, save export/import, and content updates aligned across platforms.

## 3. Module Layout

`Inferred`

```
src/
  main.ts                       # entry: bootstraps Tauri-or-browser, mounts HUD, starts loop
  app/
    bootstrap.ts                # platform detection, IndexedDB init, save-slot prompt
    routes.ts                   # title / slots / hangar / run / settings
  sim/
    runState.ts                 # RunState type + factory
    tick.ts                     # simulateTick (ordered per spec 01 §14)
    rng.ts                      # xoroshiro128+ + serialize/deserialize
    enemies/
      definitions.ts            # 12 archetypes (spec 02)
      spawner.ts                # Cycle budget + spawn cap logic
      ai.ts                     # movement intent, ranged attack, fleet behaviors
    sentinel/
      stats.ts                  # SentinelStats + applyForge + applyResearch
      firing.ts                 # targeting + projectile spawn
      defense.ts                # incoming-hit pipeline
    arsenals/
      arcCascade.ts             # one file per Arsenal
      ...                       # 9 total
    autoProcurement.ts          # see 08-auto-procurement-spec.md
    boons.ts                    # mid-run choice pool
    rewards.ts                  # currency drops + popups
  meta/
    forge.ts                    # permanent stat upgrades
    researchBay.ts              # timed research projects
    protocols.ts                # equipable run modifiers
    augments.ts                 # equipment + reroll
    arsenals.ts                 # Arsenal ownership/upgrades
    heirlooms.ts                # multiplicative permanents
    constructs.ts               # assist drones
    order.ts                    # single-player faction + weekly objectives
    warden.ts                   # AI companion + Subroutines
    archive.ts                  # tech tree + Cipher Keys
    weeklyTrial.ts              # seeded run + leaderboard mapping
  econ/
    currency.ts                 # 11 currencies, applyDelta
    achievements.ts             # achievement definitions + Prism payouts
    dailyDrop.ts                # daily/weekly claim flow
  save/
    schema.ts                   # versioned schema + migrations (spec 07)
    repository.ts               # IndexedDB layer
    autosave.ts                 # auto-save policy
    exportImport.ts             # JSON export/import
  render/
    pixiApp.ts                  # PixiJS application init
    layers.ts                   # 8 render layers (spec 01 §3)
    interpolation.ts            # render interpolation between sim ticks
    pools/
      projectilePool.ts
      popupPool.ts
    palette.ts                  # color tokens
  input/
    bus.ts                      # unified input event bus
    mouse.ts                    # PC mouse adapter
    touch.ts                    # tablet touch adapter
    keyboard.ts                 # PC keyboard adapter
    gamepad.ts                  # PC gamepad adapter
  ui/
    Hud.tsx                     # React HUD root
    panels/
      UpgradePanel.tsx
      ArsenalRow.tsx
      ProtocolRow.tsx
      AutoProcurementPanel.tsx
    screens/
      Title.tsx
      SaveSlots.tsx
      Hangar.tsx
      Settings.tsx
  audio/
    sounds.ts
    music.ts
  platform/
    isTauri.ts
    fs.ts                       # uses Tauri FS on desktop, File API on browser
    notifications.ts
  config/
    constants.ts                # tunable balance values
    enemies.json                # enemy definitions data
    arsenals.json
    protocols.json
    augments.json
    boons.json
    achievements.json
  styles/
    tokens.css                  # design tokens (--cyan, --alloy, etc.) — source of truth in 10-design-system.md
    shell.css                   # 100vw × 100vh shell grid for PC + tablet fallback
    components.css              # .chip, .pill, .rail-btn, .arsenal-slot, etc. — match 10-design-system.md §7
    overlays.css                # .screen, Research Bay / Hangar / Defeat / Launch overlay styles
    motion.css                  # all keyframes from 10-design-system.md §8
test/
  unit/
    autoProcurement.spec.ts
    damageResolution.spec.ts
    saveMigration.spec.ts
  smoke/
    coldStart.spec.ts
    cycle100Run.spec.ts
```

## 4. Sim/Render Decoupling

`Inferred`

The simulation runs at a fixed **60 Hz** in its own logical clock, independent of display refresh:

```ts
const TICK_MS = 1000 / 60;
let acc = 0;
let prev = performance.now();

function frame(now: number) {
  acc += now - prev;
  prev = now;
  while (acc >= TICK_MS) {
    simulateTick(TICK_MS / 1000, run);
    acc -= TICK_MS;
  }
  const alpha = acc / TICK_MS; // 0..1 interpolation factor
  renderScene(run, alpha);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

This keeps Cycle scaling math identical at any display refresh rate (60, 90, 120, 144 Hz) and makes Weekly Trial replays deterministic.

When the player chooses an in-game **Game Speed** of 2× or 3× (researched in the Research Bay), the build runs **2 or 3 ticks per render frame**, not a larger `dt` per tick — so determinism is preserved.

## 5. Determinism

`New` (matters for Weekly Trials and mid-run save resume)

- Every RNG draw uses the run's seeded PRNG
- Floating-point math is the only non-determinism risk; mitigate by:
  - Using `Math.fround` at API boundaries where exact reproducibility matters
  - Avoiding cross-architecture float-sensitive optimizations (no SIMD shortcuts)
- The PRNG state is part of `RunState` and is serialized into the mid-run save snapshot

## 6. PixiJS Scene Graph

`Inferred`

```
PIXI.Application (mounted into <main class="stage">)
  └─ stage (root Container)
      ├─ layer0_background     (background gradient + hex pattern)
      ├─ layer1_indicators     (range circle, spawn ring, Boon zones)
      ├─ layer2_fields         (Singularity, Corrosive Bloom, etc.)
      ├─ layer3_enemies        (enemy bodies + enemy projectiles)
      ├─ layer4_sentinel       (core, Barrier, Sentries, Charges)
      ├─ layer5_projectiles    (Sentinel projectiles, Arsenals)
      └─ layer6_popups         (currency popups, damage numbers)

DOM overlay (above the canvas) — covered in 10-design-system.md §4–6
  ├─ .topbar          (52 px — currency chips, speed, save indicator)
  ├─ .rail            (72 px left — nav buttons)
  ├─ .stage-overlay   (HP cluster, cycle badge, behemoth banner, kill feed, stage legend)
  ├─ .bottom-dock     (88 px — Protocols, Arsenals, cycle strip)
  ├─ .panel           (400 px right — Forge tabs + Auto-Procurement)
  ├─ .toasts          (floating, hidden when an overlay is open)
  └─ .screen          (full-viewport overlays: Research Bay, Hangar, Defeat, Launch)
```

The PixiJS canvas is the only WebGL surface. Every chrome element above is plain DOM driven by React + the design tokens in `src/styles/`. Pools (projectile, popup) recycle display objects to avoid GC pressure.

## 7. Input Bus

`New` (one bus serves PC and tablet)

All input — mouse click, keyboard key, touch tap, gamepad button — is normalized into an event:

```ts
type InputEvent =
  | { kind: "tap"; x: number; y: number; pointerId: number }
  | { kind: "drag"; x: number; y: number; pointerId: number }
  | { kind: "release"; pointerId: number }
  | { kind: "key"; code: KeyCode; pressed: boolean }
  | { kind: "gamepad"; button: GamepadButton; pressed: boolean };
```

Game-level handlers subscribe to the bus and don't care which device produced the event. See [09-input-and-platform-spec.md](09-input-and-platform-spec.md) for binding details.

## 8. State Store

`Inferred`

Two separate stores:

- **Sim store** — owned by `RunState`. Mutated only inside `simulateTick`. The render layer reads but never writes.
- **UI store** — owned by Zustand. Holds HUD-projected values (formatted numbers, panel-open state, settings). The sim periodically pushes updates to the UI store at HUD-friendly cadence (~10 Hz, not every tick).

This split prevents React re-renders from interfering with sim performance.

## 9. Save System Boundary

`New`

Saves are owned by `src/save/`. The sim never touches IndexedDB directly. Auto-save policy:

- Every Cycle completion
- Every meta-progression purchase (Forge, Research Bay project start, Protocol slotted, etc.)
- On run end (final write)
- On window blur / `visibilitychange` to "hidden" — defensive write
- Crash-safe: write to a staging key, then atomic-swap onto the main key

Full spec in [07-save-system-spec.md](07-save-system-spec.md).

## 10. Build Targets

`New`

| Target | Output | Notes |
|---|---|---|
| Web (development) | `vite dev` on `localhost:5173` | Hot reload |
| Web (production PWA) | `vite build` → static site | Includes Service Worker + Web App Manifest. Hostable as static files. |
| Tauri desktop (Windows) | `tauri build` → `.msi` installer | Rust shell wraps the static site |
| Tauri desktop (macOS) | `tauri build` → `.dmg` | Codesigning required for distribution |
| Tauri desktop (Linux) | `tauri build` → `.AppImage` / `.deb` | |
| Future: Android tablet | Capacitor wrap of the PWA | Not in initial scope; PWA install on Android Chrome is sufficient |
| Future: iPad | PWA install via Safari, or Capacitor | Not in initial scope |

## 11. Performance Budget

`Inferred`

Target hardware:

- **Low-end tablet** (iPad 8th gen, mid-range Android 2020-era): 60 fps at Cycle 1000
- **Modern desktop**: 144 fps at Cycle 5000
- **Cold start to playable**: < 2 seconds on cached load

Practices:

- Object pooling for projectiles, popups, particles
- Spatial hashing for enemy lookups (uniform grid sized to enemy max radius)
- One PixiJS `Graphics` object per persistent shape; per-frame mutation, not destroy/recreate
- Particle cap (1000 simultaneous) with FIFO cull
- Low-VFX mode for sustained late-game runs

## 12. Asset Pipeline

`Inferred`

The visual style is geometric — most "art" is generated procedurally with PixiJS `Graphics`. Asset files are minimal:

- Theme palettes: JSON
- Sounds: WAV/OGG, lazy-loaded by Howler
- Fonts: one variable display font, one mono for numbers
- Achievement icons: simple SVG

Assets live in `src/config/`-adjacent directories and are imported by Vite directly.

## 13. Save/Telemetry/Network

`New`

- **Save**: local-only by default. Optional cloud sync via JSON export/import — the player is in control.
- **Telemetry**: opt-in only. If enabled, anonymized run summaries POST to a static endpoint of the player's choosing (or none — this is single-player).
- **Network**: only optional Weekly Trial seed file fetch (a static JSON URL) and optional achievements-pack updates. No login. No accounts.

## 14. Testing Strategy

`Inferred`

- **Unit tests** (Vitest) for: sim tick math, damage resolution pipeline, Auto-Procurement decision logic, save schema migrations, currency-balance changes
- **Property tests** for: deterministic replay (same seed + same inputs → same output)
- **Smoke tests** (Playwright) for: cold start, save slot create/load/delete, run a Cycle 100 stretch, export/import a save round-trip

## 15. Open Questions For The Build Team

- Whether to ship both Tauri and PWA at launch, or PWA-first then Tauri
- Whether Steam distribution is in scope (would add Steamworks integration via Tauri sidecar)
- Whether to attempt iPad-native via Capacitor at launch (recommend: ship PWA first; Capacitor as a follow-up if browser perf is insufficient)
- Final UI framework choice for HUD: React (recommended) vs Solid (more performant, smaller team familiarity)
