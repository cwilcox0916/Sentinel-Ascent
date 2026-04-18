# Build Roadmap

This document sequences the implementation of `Sentinel Ascent` from empty repo to shippable build. Phases are ordered so each one ends with a runnable, demoable artifact — never a half-built half-system.

`New`

## Principles

1. **Vertical slices, not horizontal layers.** Every phase ends with something playable end-to-end, even if shallow. We don't build "all the systems" then "all the UI" — we build one slice deep and widen.
2. **MVP gates the rest.** Phases 0–4 produce the MVP gate (defined in [00-handoff-index.md](00-handoff-index.md) "Recommended Build Order (MVP First)"). Don't skip ahead.
3. **Determinism from day 1.** Seeded PRNG, fixed-step sim, snapshot-resumable. Adding determinism later is painful; we bake it in.
4. **Design tokens before components.** All CSS work uses tokens from [10-design-system.md](10-design-system.md) — we never hardcode colors.
5. **Every phase ends with tests + a smoke run.** Vitest unit tests for new logic; a Playwright smoke test for the new UI surface.

## Phase 0 — Repo + Toolchain (1–2 days)

**Goal**: Empty Vite + TS app boots in browser and inside Tauri, with design tokens loaded.

Deliverables:

- `package.json`, `vite.config.ts`, `tsconfig.json` (strict mode on)
- `src/main.ts` mounts an empty React HUD root and an empty PixiJS canvas
- `src/styles/tokens.css` populated from [10-design-system.md](10-design-system.md) section 2
- `src/styles/shell.css` with the locked grid (PC ≥1280 + tablet fallback)
- `index.html` with Inter + JetBrains Mono via `<link>`
- `src-tauri/` scaffolded via `tauri init` (Tauri 2.10, identifier `com.sentinelascent.game`, window 1280×800 with min 960×640); `npm run tauri:dev` launches a native window with the same shell
- `vitest.config.ts` and one trivial passing test
- `playwright.config.ts` and one trivial passing smoke test
- Manifest + Service Worker for PWA install

Done when: `npm run dev` shows the empty shell at `localhost:5173`; `npm run tauri dev` shows the same shell in a native window; tablet PWA install works.

## Phase 1 — Combat Sim Core (3–5 days)

**Goal**: A deterministic 60 Hz simulation with a Sentinel that auto-fires at moving Drones.

Deliverables:

- `src/sim/rng.ts` — xoroshiro128+ with serializable state
- `src/sim/runState.ts` — `RunState` factory with seed
- `src/sim/tick.ts` — fixed-step loop in the tick order from [01-core-runtime-and-combat-spec.md](01-core-runtime-and-combat-spec.md) §4 (skip Auto-Procurement step for now — placeholder)
- `src/sim/sentinel/{stats,firing,defense}.ts` — minimal stats (Damage, Attack Speed, Range, Health) + firing + incoming-hit pipeline
- `src/sim/enemies/{definitions,spawner,ai}.ts` — Drone only; Cycle-based spawn budget; radial inward movement
- `src/render/pixiApp.ts` + `src/render/layers.ts` — 8 named Containers per [10-design-system.md](10-design-system.md) §6 architecture
- Render the Sentinel core, a range circle, Drones, and cyan Sentinel projectiles
- Render interpolation between sim ticks at display refresh rate

Tests: deterministic-replay property test (same seed + zero player input → identical 600-tick output).

Done when: clicking "Run" starts a deterministic Drone wave around the Sentinel, projectiles fire on cooldown, Drones die on hit, Cycle ticks up.

## Phase 2 — Forge + Scrip + Alloy (2–3 days)

**Goal**: Player can buy in-run upgrades during combat. Currency persists into a session-only profile.

Deliverables:

- `src/sim/rewards.ts` — Drone kill grants Scrip + Alloy; Cycle completion grants bonus
- `src/meta/forge.ts` — Forge stat catalogue per [01-core-runtime-and-combat-spec.md](01-core-runtime-and-combat-spec.md) §6 (start with the MVP subset: Damage, Attack Speed, Range, Health, Defense %, Thorns, Repulse Chance, Sentries, Lifesteal, Scrip Bonus, Alloy/Kill Bonus)
- `src/econ/currency.ts` — typed currency state + `applyDelta`
- `src/ui/panels/UpgradePanel.tsx` — Forge tabs (Attack / Defense / Utility) + scrollable `.up-row` list, exact selectors and tokens from [10-design-system.md](10-design-system.md) §4 + §7
- `src/ui/panels/Hud.tsx` — top bar with the 6 currency chips, runtime pill, speed selector, pause pill, save indicator (per the locked design)

Tests: Vitest unit for cost-curve math; Playwright click-buy → stat-increase + Scrip-decrease.

Done when: a player can spend Scrip to raise Damage; the Sentinel actually fires harder; the top bar updates currency chips in real time.

## Phase 3 — 5-Slot Save System (3–4 days)

**Goal**: Five fully isolated profiles with mid-run snapshot resume.

Deliverables:

- `src/save/schema.ts` — `SaveSlot` + `RunSnapshot` types from [07-save-system-spec.md](07-save-system-spec.md) §4 + §6
- `src/save/repository.ts` — IndexedDB layer via `idb`, crash-safe write protocol per [07-save-system-spec.md](07-save-system-spec.md) §8
- `src/save/autosave.ts` — autosave triggers (Cycle complete, meta purchase, run end, visibility change)
- `src/save/exportImport.ts` — JSON export + import (Tauri native dialog + browser file API)
- `src/ui/screens/SaveSlots.tsx` — title-screen 5-slot picker per [07-save-system-spec.md](07-save-system-spec.md) §11
- Migration registry stub (1 → 2 placeholder for testing)
- `.save-ind` flash on every successful save (matches design)

Tests: round-trip slot, crash-recovery, mid-run snapshot determinism (snapshot at Cycle 50, resume, 100 ticks → identical to non-snapshotted run).

Done when: cold launch → pick slot → run a Cycle 50 stretch → close window → reopen → resume mid-run with identical state. Export to JSON, wipe IndexedDB, import → fully restored.

## Phase 4 — Auto-Procurement Tier 1 (2 days)

**Goal**: The user-requested feature, MVP version.

Deliverables:

- `src/sim/autoProcurement.ts` — Tier 1 single-channel logic per [08-auto-procurement-spec.md](08-auto-procurement-spec.md) §6, evaluated at the spec'd tick position
- `src/ui/panels/AutoProcurementPanel.tsx` — `.ap-panel` with master toggle + 3 channel cards, exact tokens from the design
- HUD feedback: `.tab .auto-glow` pulse, `.up-row .autobuy` keyframe, `.toast.auto` per buy
- Slot state for unlocked tier + active configuration; persisted via the save system
- The Tier 1 unlock is granted by default for MVP (Research Bay project that gates it ships in Phase 6)

Tests: Tier 1 deterministic decision; reserve floor; Vitest property test that snapshot resume preserves Auto-Procurement runtime state byte-identically.

**MVP gate.** At end of Phase 4, the build is shippable as an alpha: deterministic combat, Forge upgrades, save/resume, Auto-Procurement Tier 1.

## Phase 5 — Enemy Roster Expansion (3–4 days)

**Goal**: 4 normal types + Behemoth, with Cycle scaling.

Deliverables:

- Skimmer, Hulk, Lancer enemy definitions + behaviors per [02-enemies-and-wave-spec.md](02-enemies-and-wave-spec.md) §3
- Behemoth (boss) per §4: high HP, Annihilator-Beam-immune, Protocol-lock signal
- Cycle scaling curves per §17
- Behemoth alarm + HP bar HUD overlays per [10-design-system.md](10-design-system.md) §4 stage overlays
- Stage legend bottom-left; Kill feed bottom-right

Done when: Behemoth spawns every 10 Cycles, alarm + HP bar appear, Skimmers leak more often than Hulks.

## Phase 6 — Research Bay Overlay (4–5 days)

**Goal**: Full Research Bay screen with Auto-Procurement tier ladder + Project Acceleration.

Deliverables:

- `src/meta/researchBay.ts` — project definitions, real-time progression, slot management
- `src/ui/screens/ResearchBay.tsx` — full overlay per [10-design-system.md](10-design-system.md) §6.1
- Tier ladder: Tier 1, 2, 3, 4 with state badges (owned / researching / locked / queued)
- Tier-queueing behavior (queue Tier 4 behind Tier 3, auto-deduct on completion)
- Rail-button completion glow when a project finishes off-screen
- `tierComplete` keyframe on completion
- Auto-Procurement Tier 2 logic per [08-auto-procurement-spec.md](08-auto-procurement-spec.md) §7

Done when: opening Research Bay shows tiers, the player can research Tier 2, Tier 2 unlocks multi-channel auto-buy, rail glow fires on completion.

## Phase 7 — Hangar Overlay (4–5 days)

**Goal**: Meta hub for Sentinel selection, Stratum picking, loadout summary, launch countdown.

Deliverables:

- `src/ui/screens/Hangar.tsx` — full overlay per [10-design-system.md](10-design-system.md) §6.2
- Sentinel list (left), blueprint hero (center) with callouts + scanline, stat strip, loadout chips, Heirloom strip, modifier banner
- `src/meta/strata.ts` — Stratum definitions, per-Stratum modifier flags, last-run record
- `src/ui/screens/LaunchCountdown.tsx` — `lcRing` + `lcPulse` countdown overlay per [10-design-system.md](10-design-system.md) §6.2
- Hangar ↔ in-run flow: Launch → countdown → run, run end → either Defeat (Phase 8) or back to Hangar

Done when: player can pick a Sentinel, pick a Stratum 1–9, launch with a 3-2-1 countdown.

## Phase 8 — Defeat Overlay (2 days)

**Goal**: Closes the run loop with a dramatic + analytical post-run screen.

Deliverables:

- `src/ui/screens/Defeat.tsx` — full overlay per [10-design-system.md](10-design-system.md) §6.3
- HP-over-time sparkline (collected during the run, drawn at defeat)
- Key Events timeline (collected from a Run Log buffer)
- Reward roll-up animation (`counterFlash`)
- Heirloom drop callout when a run rolls one
- Retry / Adjust / Dismiss CTAs

Done when: dying triggers the Defeat overlay, the sparkline matches the run's actual HP history, Retry restarts the same Stratum + loadout, Adjust returns to Hangar.

## Phase 9 — Auto-Procurement Tiers 3 + 4 (3–4 days)

**Goal**: Full Auto-Procurement depth.

Deliverables:

- Tier 3 logic per [08-auto-procurement-spec.md](08-auto-procurement-spec.md) §8 (per-stat priorities, round-robin fairness, Loadouts)
- Tier 4 rules engine per §9 (sensors, comparators, actions, first-match vs all-match)
- `src/ui/panels/AutoProcurementTier3.tsx` — per-stat editor with priority sliders
- `src/ui/panels/AutoProcurementTier4.tsx` — visual rule editor (no grammar typing)
- Canned rule templates: Defensive Stand, Boss Cycle Focus, Fleet Lockdown, Save For Wall, Late-Run Economy Tilt

Done when: Tier 3 prioritizes correctly, Tier 4 rule "if HP < 50% then ONLY_BUY health/defense" measurably overrides priorities under that condition.

## Phase 10 — Protocols, Augments, Arsenals (5–7 days)

**Goal**: The three big equipment systems wired in.

Deliverables:

- Protocols (3 starter slots, 10 starter Protocols, level-up via copies) — per [04-progression-systems.md](04-progression-systems.md) §6
- Augments (4 starter slots, Augment Fragments + Flux Crystals) — per §9
- Arsenals (3 starter Arsenals: Arc Cascade, Seeker Salvo, Stasis Field; Cores currency) — per §8
- Bottom dock fully populated: Protocol slots, 9 Arsenal slots (3 visible at MVP), Cycle strip
- Protocol equip lock during Behemoth/fleet alive

Done when: equipping a Protocol changes a stat, an Arsenal auto-fires on cooldown, an Augment with rolled affixes shows correct values.

## Phase 11 — Boons + Heirlooms + Constructs (3 days)

**Goal**: Mid-run choices and permanent multipliers.

Deliverables:

- Boons mid-run choice UI every 25 Cycles per [04-progression-systems.md](04-progression-systems.md) §7
- Heirloom inventory + slotting (Heirloom strip in Hangar) per §10
- Constructs starter set per §11

## Phase 12 — Economy Sources, Achievements, Daily Drop (3 days)

**Goal**: All free-progression Prism sources working.

Deliverables:

- `src/econ/dailyDrop.ts` — daily streak claim per [05-currencies-and-economy.md](05-currencies-and-economy.md) §15
- `src/econ/achievements.ts` — 50 launch achievements (rest deferred); Prism payouts
- Stratum Milestones (every 50 Cycles)
- Calibration pass against the targets in [05-currencies-and-economy.md](05-currencies-and-economy.md) §19

## Phase 13 — Order, Warden, Subroutines, Weekly Trials (5–7 days)

**Goal**: The single-player conversions of multiplayer systems.

Deliverables:

- `src/meta/order.ts` — solo Order, weekly objectives, season tracker, auto-conversion
- `src/meta/warden.ts` — Warden + Subroutines (6 launch chips)
- `src/meta/weeklyTrial.ts` — seeded weekly Trial run + local leaderboard mapping → Cipher Keys
- Order Shop UI (rotating catalog)
- Optional ghost-replay JSON export/import

## Phase 14 — Fleet Enemies + Archive (4–5 days)

**Goal**: Late-game depth.

Deliverables:

- Disruptor, Overseer, Resonant per [02-enemies-and-wave-spec.md](02-enemies-and-wave-spec.md) §10–13
- Fleet immunities + spawn schedule (§14, §16)
- Augment Fragment / Flux Crystal drop tables (§15)
- Archive tech tree per [04-progression-systems.md](04-progression-systems.md) §14
- Cipher Key spending UI

## Phase 15 — Tablet Polish + Performance (3–4 days)

**Goal**: Hit perf targets and ship the tablet PWA.

Deliverables:

- Per [09-input-and-platform-spec.md](09-input-and-platform-spec.md): touch targets at 56 px, 44 px pills, layout swap below 1280 px
- Object pooling audit (projectiles, popups, particles)
- Spatial hashing for enemy lookups
- Low VFX mode toggle
- 60 fps target on 2020-era tablet at Cycle 1000
- Reduced-motion + color-blind palettes per [10-design-system.md](10-design-system.md) §14

## Phase 16 — Settings, Accessibility, Tauri Distribution (3 days)

**Goal**: Ship-ready desktop builds.

Deliverables:

- Full Settings screen: audio sliders, low-VFX toggle, reduced-motion toggle, color-blind palette, key rebinding, gamepad rebinding, telemetry opt-in
- Tauri builds: Windows `.msi`, macOS `.dmg`, Linux `.AppImage`
- Auto-update via Tauri updater (manual check)
- PWA Service Worker rolling update
- All cross-platform tests in [09-input-and-platform-spec.md](09-input-and-platform-spec.md) §14 passing

## Phase 17 — Closed Alpha → Open Beta (ongoing)

- Close-out: 50 testers via local file distribution + PWA URL
- Telemetry pass (opt-in only)
- Balance pass against the [05-currencies-and-economy.md](05-currencies-and-economy.md) §19 calibration targets
- Bug-fix sprint
- Public PWA release; Tauri installers via website

## Estimated Calendar

This is a solo-developer estimate at ~25 hours/week. Multiply or divide based on team size.

| Phase | Range | Cumulative |
|---|---|---|
| 0. Toolchain | 1–2 days | ~1 week |
| 1. Sim core | 3–5 days | ~2 weeks |
| 2. Forge + currency | 2–3 days | ~3 weeks |
| 3. Save system | 3–4 days | ~4 weeks |
| 4. Auto-Procurement T1 | 2 days | **~5 weeks (MVP gate)** |
| 5. Enemy roster | 3–4 days | ~6 weeks |
| 6. Research Bay | 4–5 days | ~7 weeks |
| 7. Hangar | 4–5 days | ~8.5 weeks |
| 8. Defeat | 2 days | ~9 weeks |
| 9. Auto-Procurement T3 + T4 | 3–4 days | ~10 weeks |
| 10. Protocols/Augments/Arsenals | 5–7 days | ~12 weeks |
| 11. Boons/Heirlooms/Constructs | 3 days | ~13 weeks |
| 12. Economy sources | 3 days | ~14 weeks |
| 13. Order/Warden/Trials | 5–7 days | ~16 weeks |
| 14. Fleet + Archive | 4–5 days | ~17 weeks |
| 15. Tablet + perf | 3–4 days | ~18 weeks |
| 16. Settings + Tauri | 3 days | ~19 weeks |
| 17. Beta | open | — |

Roughly **5 months solo to a shippable v1.0** with the full feature set; MVP at ~5 weeks.

## Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Determinism breaks late (floats drifting across machines) | Bake in from Phase 1 with property tests; run smoke replays in CI on Linux + Windows + macOS |
| PixiJS perf at Cycle 5000 | Profile from Phase 5 onward, not at the end; budget 1000 simultaneous particles |
| Save schema migration debt | Every breaking change requires a migration + a fixture test before merge |
| Tablet touch ergonomics never get tested in the real flow | Phase 15 is dedicated, but also: every PR description includes a tablet smoke step |
| Scope creep on Order / Trials (single-player conversions) | Phase 13 is timeboxed — if it overruns, the Order ships with weekly objectives only and Subroutines defer to v1.1 |
| Engine-creep (someone wants to add a physics lib, a UI framework, a SCSS preprocessor) | All stack additions require updating [06-architecture-and-tech-stack.md](06-architecture-and-tech-stack.md) — friction is the point |

## Definition Of Done (per phase)

A phase is complete when:

1. Every deliverable in the phase is implemented
2. Vitest unit tests for new logic pass
3. Playwright smoke test exercising the new UI surface passes
4. `tauri dev` and `vite dev` both launch cleanly
5. The new UI surface uses **only** tokens from `src/styles/tokens.css` (no hardcoded colors)
6. The phase's "Done when" criterion is demonstrable in a single screen recording
7. The save system continues to round-trip cleanly (no save break without a migration)

## Immediate Next Action

Start Phase 0:

1. `npm create vite@latest sentinel-ascent -- --template react-ts`
2. `cd sentinel-ascent && npm install pixi.js@8 idb howler zustand`
3. `npm install -D vitest @playwright/test`
4. `npx tauri init`
5. Create `src/styles/tokens.css` from [10-design-system.md](10-design-system.md) §2
6. Create `src/styles/shell.css` with the locked grid from §4
7. Run `npm run dev` and verify the empty shell renders with the design tokens applied
