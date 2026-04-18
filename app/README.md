# Sentinel Ascent

Single-player radial survival-defense incremental game. PC + tablet, no microtransactions.

Design and PRDs live in [`../docs/my_game/`](../docs/my_game/). Build roadmap is [11-build-roadmap.md](../docs/my_game/11-build-roadmap.md).

## Stack

TypeScript + Vite + React (HUD only) + PixiJS v8 (Grid) + IndexedDB via `idb` (saves) + Howler (audio) + Zustand (UI store) + Vitest + Playwright + Tauri 2 (desktop wrapper).

## Phase 0 — what works now

- Empty shell renders with the locked design tokens and grid layout from [10-design-system.md](../docs/my_game/10-design-system.md)
- PixiJS Application mounts into the Stage canvas (empty)
- Top bar, left rail, stage, bottom dock, right panel all present as placeholders
- Tablet fallback (<1280px) hides the bottom dock and docks the panel to the bottom
- Vitest + Playwright wired
- Tauri 2 scaffolded — desktop window opens at 1280×800, min 960×640

## Commands

```sh
npm install
npm run dev            # vite dev at http://localhost:5173
npm run build          # tsc + vite build (static site)
npm run test           # vitest unit tests
npm run test:e2e       # playwright smoke tests (boots dev server)
npm run tauri:dev      # native desktop window (boots vite + Rust shell)
npm run tauri:build    # production .msi/.dmg/.AppImage installer
```

> **Tauri requires Rust on PATH.** If `cargo --version` fails in your shell, restart it after installing Rust via `rustup`, or add `~/.cargo/bin` to PATH manually.

## Source layout

See [06-architecture-and-tech-stack.md](../docs/my_game/06-architecture-and-tech-stack.md) §3.
