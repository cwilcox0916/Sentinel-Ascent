# Progress Log

This doc captures the **actual state of the build** as of the latest work session. It's the companion to [11-build-roadmap.md](11-build-roadmap.md), which is aspirational — this doc is what's real.

## Current State (end of Phase 17)

**Phases complete**: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 (alpha-ready)
**Next up**: Closed alpha test → balance feedback → v1.0 public

**Test suite**: ✅ 173/173 passing
**TypeScript**: ✅ strict clean
**Visual verification**: all phases confirmed in Claude Preview + Chrome MCP (cross-browser validation from Phase 6 onward)

## Repo layout

```
F:/Projects/games/Sentinel Ascent/
├─ docs/main_game/         # source pack (cloned game's design; renamed everywhere)
├─ docs/my_game/           # Sentinel Ascent PRDs — 12 docs
│  ├─ 00-handoff-index.md
│  ├─ 01-core-runtime-and-combat-spec.md
│  ├─ 02-enemies-and-wave-spec.md
│  ├─ 03-visual-style-ui-and-feedback.md
│  ├─ 04-progression-systems.md
│  ├─ 05-currencies-and-economy.md
│  ├─ 06-architecture-and-tech-stack.md
│  ├─ 07-save-system-spec.md
│  ├─ 08-auto-procurement-spec.md
│  ├─ 09-input-and-platform-spec.md
│  ├─ 10-design-system.md       # locked visual design (tokens + components)
│  ├─ 11-build-roadmap.md       # 17-phase plan
│  └─ 12-progress-log.md        # this file
└─ app/                    # the actual TypeScript + Vite + PixiJS build
   ├─ src/
   │  ├─ sim/              # deterministic 60 Hz simulation
   │  ├─ render/           # PixiJS renderers
   │  ├─ meta/             # Forge, Research Bay, Strata, buyUpgrade
   │  ├─ save/             # IndexedDB + snapshot + migrations (schema v3)
   │  ├─ store/            # Zustand stores (app/run/save)
   │  ├─ ui/               # React components, all matching design tokens
   │  ├─ styles/           # tokens.css + shell.css + components.css + overlays.css
   │  └─ vite-env.d.ts
   ├─ src-tauri/           # Tauri 2 desktop wrapper (initialized, not yet bundled)
   ├─ tests/smoke/         # Playwright smoke tests
   └─ package.json
```

## Stack

- **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Vite 6** + **vite-plugin-pwa**
- **React 18** (HUD only — the Grid is pure PixiJS)
- **PixiJS v8** — WebGL renderer for the Grid
- **Zustand v5** — state management
- **idb** — IndexedDB wrapper for saves
- **Howler** — audio (installed, not wired yet)
- **Vitest** — unit tests (73 passing)
- **Playwright** — smoke tests
- **Tauri 2** — desktop wrapper (Rust + WebView2, scaffolded)

## Commands

```sh
cd app
npm install
npm run dev             # vite dev at :5173
npm run build           # production bundle + PWA service worker
npm run test            # vitest
npm run tauri:dev       # native desktop window (Rust on PATH required)
```

## Dev debug hooks

`window.__sa` is live in dev (gated by `import.meta.env.DEV`):

- `window.__sa.run` — the live `RunState`
- `window.__sa.slot` — the active `SaveSlot`
- `window.__sa.jumpToCycle(n)` — jump to a specific Cycle (used to force Behemoth)
- `window.__sa.skipResearch(seconds)` — fast-forward all in-flight research jobs
- `window.__sa.finishResearch()` — complete all in-flight research immediately
- `window.__sa.grant({ alloy?, catalyst?, prisms? })` — credit currencies

Stripped from production bundles automatically.

## Phase-by-phase summary

### Phase 0 — Toolchain
Vite + React + PixiJS + Tauri scaffolded. Design tokens (`tokens.css`) and shell grid (`shell.css`) in place. PWA manifest wired. Tests green on cold boot.

### Phase 1 — Sim Core
Deterministic 60 Hz loop with xoroshiro128+ PRNG. Sentinel auto-fires at Drones. Fixed-timestep sim + interpolated render via `alpha`. World-fit scaling (min dim / 380 clamped to [0.45, 1.0]) keeps Sentinel centered on any viewport. 3 determinism tests.

**Key files**: `src/sim/{rng.ts, runState.ts, tick.ts, types.ts}`, `src/render/{layers.ts, runRenderer.ts, sentinelRenderer.ts, enemyRenderer.ts, projectileRenderer.ts, palette.ts}`

### Phase 2 — Forge
9 in-run upgrades across Attack/Defense/Utility tabs. Exponential cost curves. `applyForge` recomputes derived stats from base + levels. Defense pipeline applies Defense %, Thorns, Lifesteal. Click-to-buy works; HUD currency chips live-update.

**Key files**: `src/meta/{forge.ts, buyUpgrade.ts}`, `src/sim/{rewards.ts, sentinel/defense.ts}`, `src/ui/panels/UpgradePanel.tsx`

### Phase 3 — Save System
5-slot IndexedDB persistence with crash-safe staging-key writes + 3-deep backup rotation. Mid-run `RunSnapshot` (BigInt serialized as string) resumes deterministically. JSON export/import via browser File API. `Autosave` coordinator coalesces within 2 s cooldown. Save indicator flashes on every successful write.

**Key files**: `src/save/{schema.ts, snapshot.ts, repository.ts, migrations.ts, autosave.ts, exportImport.ts}`, `src/ui/screens/SaveSlots.tsx`, `src/store/{appStore.ts, saveStore.ts}`

### Phase 4 — Auto-Procurement (MVP gate)
Tier 1 single-channel auto-buy. Evaluated deterministically inside `simulateTick` (after enemy update, before Sentinel firing). `.tab.auto-on` pulse + `.up-row.auto-bought` flash + `.toast.auto` per buy. AP state in RunSnapshot round-trips through save/restore.

**Key files**: `src/sim/autoProcurement.ts`, `src/ui/panels/AutoProcurementPanel.tsx`, `src/ui/Toasts.tsx`

### Phase 5 — Enemy Roster
4 normal archetypes (Drone / Skimmer / Hulk / Lancer) with distinct silhouettes, per-Cycle composition ramp (1–2: Drones; 3: +Skimmer; 5: +Hulk; 7: +Lancer). Lancer has ranged projectiles. Behemoth scheduled every 10 Cycles — oversized red octagon with top-center HP bar and alarm banner. `.stage-legend` shows color key.

**Key files**: `src/sim/enemies/{definitions.ts, spawner.ts, ai.ts}`, `src/sim/enemyProjectiles.ts`, `src/render/{enemyRenderer.ts, enemyProjectileRenderer.ts}`

### Phase 6 — Research Bay
Full-viewport overlay with spec-accurate durations (30 min → 7 days). 4 AP tier projects + Project Acceleration + Overclock lines. 3 research slots, queue-after-in-flight, cancel queued. Project Acceleration × Overclock multipliers stack multiplicatively. Rail click-to-toggle + Esc-to-close. Completion glow on rail button when bay is closed. Tier 2 unlocks multi-channel AP with per-channel reserve floors.

**Key files**: `src/meta/researchBay.ts`, `src/ui/screens/ResearchBay.tsx`, `src/ui/ResearchBayHost.tsx`

Schema bumped to **v2** (researchBay added).

### Phase 7 — Hangar
Meta hub route between Title and in-game. 18 Strata with escalating scaling (1.0× → 115×) and unlock gates by highestCycle. Sentinel list (Vigil-07 unlocked; Rend-02/Echo-11/Classified as Phase 10 placeholders). Blueprint SVG hero with 4 callouts + scanline + 5-cell stat strip + 4 loadout chips. Stratum ladder with LOCK/MAX badges. Last Run card populated on run end (cause of death inferred from surviving enemies). Launch button → 3-2-1-GO countdown overlay → in-game. "↩ Hangar" button in top bar replaces old "↩ Title".

**Key files**: `src/meta/strata.ts`, `src/ui/screens/{Hangar.tsx, LaunchCountdown.tsx}`

Schema bumped to **v3** (selectedStratum, runsLaunched, lastRun added).

### Phase 8 — Defeat overlay
Full-viewport post-run overlay per [10-design-system.md](10-design-system.md) §6.3. Host-side `RunLog` (not part of RunState → no determinism impact) collects HP samples at ~2 Hz, rolling-3s Peak DPS, kill counter, and event timeline (run launched / Behemoth appear/defeat / Cycle-10 milestones / Sentinel offline). On death the host synthesizes a `DefeatSummary` into `runStore.defeat`, which mounts `<Defeat/>` as a sibling overlay. Left half: "▲ RUN TERMINATED" stamp, `SENTINEL DOWN` headline with red glow, fragmented-blueprint backdrop, CYCLE-big block with PB delta, cause-of-death card. Right half: 6-cell stat grid, HP sparkline (SVG path + dashed event markers + terminal death marker), key events timeline, 4 reward cards with `counterFlash` roll-up, and CTAs: RETRY (bumps `runEpoch` → Stage remounts fresh), ADJUST (routes to Hangar), DISMISS (Esc-able). Tiny sim telemetry counters added (`run.stats.kills`, `run.stats.damageDealt`) and serialized for snapshot continuity.

**Key files**: `src/meta/runLog.ts`, `src/ui/screens/Defeat.tsx`, `src/styles/overlays.css` (§Defeat block), Stage.tsx (RunLog wiring + defeat commit), appStore (`runEpoch`), runStore (`defeat`, `DefeatSummary`).

### Phase 9 — Auto-Procurement Tiers 3 + 4
Full AP depth shipped. **Tier 3** adds per-stat toggles + priority 1–10 + optional round-robin fairness (tie-breaks by least-recently-bought-tick). **Tier 4** is a simple rules engine — sensors (`sentinel.hpPercent`, `cycle`, `cycle.isBoss`, `scrip`, `enemiesAlive`, `runDurationSeconds`), six comparators, five action kinds (`SET_PRIORITY`, `DISABLE_CATEGORY`, `ENABLE_CATEGORY`, `PAUSE_AUTO_BUY`, `ONLY_BUY`), first-match or all-match mode. Ships five canned templates: Defensive Stand, Boss Cycle Focus, Save For Wall, Late-Run Economy Tilt, Swarm Lockdown. Rule cap enforced at 5. Rule policy is resolved per-tick by overlaying matching rules' ACTIONs on top of the Tier 3 targeted baseline; `PAUSE_AUTO_BUY` short-circuits the tick. UI now routes by `activeTier` with header tier-switch pills (1/2/3/4); unlocked tiers are clickable, locked tiers are disabled. Tier 2 view got its dedicated multi-channel reserve UI; Tier 3 adds a per-stat priority list with sliders; Tier 4 adds a rule library picker + toggle/delete per rule + mode radio.

**Key files**: `src/sim/autoProcurement.ts` (now ~400 lines with resolver + action applier), `src/save/snapshot.ts` (tier3/tier4 serialize + restore), `src/save/schema.ts` (SerializedAutoProcurement extensions), `src/ui/panels/AutoProcurementPanel.tsx` (router + Tier1View/Tier2View/Tier3View/Tier4View), `src/styles/components.css` (~300 lines of AP T2/T3/T4 CSS), `src/store/runStore.ts` (tier2Channels/tier3/tier4 views + 9 new actions), `src/ui/Stage.tsx` (action wiring).

Deterministic Vitest coverage: priority ordering, round-robin alternation, disabled-stat filtering, snapshot resume parity for Tier 3; Defensive-Stand ONLY_BUY narrows candidates, Save-For-Wall PAUSE, 5-rule cap, first-match precedence for Tier 4.

### Phase 10 — Protocols, Augments, Arsenals
All three equipment systems shipped end-to-end.

**Protocols** (`src/meta/protocols.ts`) — 10 starter Protocols (Overclock, Rapid Fire, Long Barrel, Reinforced Plating, Adaptive Armor, Spike Array, Parasitic Ion, Price Gouger, Scavenger, Crit Matrix) with per-level stat effects. 3 base slots. 10 Prisms per copy, `1 << level` copies to level up (level 1→2 = 2, 6→7 = 64). Protocol panel **locked** while a Behemoth is alive (enforced in store selector + UI + action handler).

**Arsenals** (`src/meta/arsenals.ts`, `src/sim/arsenals.ts`) — 3 starter Arsenals with real sim behavior:
- **Arc Cascade** — passive on-hit proc (5+3*L% chance) that deals bonus damage to the 2 nearest neighbors of the hit enemy; uses the run's seeded PRNG so identical seed + identical loadout produces identical proc sequence
- **Seeker Salvo** — timed Arsenal (8s base cooldown, ×0.9^(L-1) per level); spawns 2+⌊L/2⌋ homing projectiles aimed at nearest enemies
- **Stasis Field** — timed Arsenal (12s base cooldown); writes slow debuffs into `run.arsenals.slowedUntil` for enemies inside a 180-unit radius; enemy AI multiplies speed by the slow factor while slowed

All fire from a new tick step (step 8 in tick.ts), after Sentinel fires, before projectile resolution. Cooldowns decay at fixed 60 Hz. Cores currency for level-up; geometric cost curve (5 * 1.8^L).

**Augments** (`src/meta/augments.ts`) — skeleton: 4 slots, 4 starter Augments (Pulse Emitter, Impact Lens, Shield Capacitor, Tracer Cog) with flat per-level stat bonuses. Augment Fragments currency. Full rarity/affix/reroll system reserved for a polish phase.

**Stat pipeline** — `recomputeSentinelStats(run)` now layers (in order): base → Protocols → Augments → Forge. The pre-layer callback into `applyForge` means Forge percentages compound on top of Protocol/Augment buffs, not raw base.

**UI** — `BottomDock.tsx` fully rebuilt: 3 Protocol slots (initials + level chip, cyan border when filled, dashed when empty), 3 Arsenal slots (AC/SS/SF initials, L-level chip, prism border when equipped, transform-based cooldown overlay that scales bottom-up), Cycle strip (10 ticks, cyan pulse on current, threat-red on every 10th Behemoth cycle), Protocol-lock badge next to the section header when a Behemoth is on the Grid. `Loadout.tsx` overlay: 3 tabs (Protocols/Arsenals/Augments), slot cards + library grid, inline Acquire/Level-Up/Equip/Disarm actions, currency chips in the header.

**Save schema bumped to v4**: `protocols`, `arsenals`, `augments` added to SaveSlot; migration `3 → 4` hydrates defaults. Loadout state is shared by reference between slot and RunState (via `run.protocolSlot`, `run.arsenalSlot`, `run.augmentSlot`), so equips in the Loadout overlay mutate the same objects the sim reads.

**Key files**: `src/meta/{protocols,arsenals,augments}.ts`, `src/sim/arsenals.ts`, `src/ui/screens/Loadout.tsx`, `src/ui/BottomDock.tsx`, `src/store/runStore.ts` (LoadoutView + 8 new actions), `src/meta/buyUpgrade.ts` (recomputeSentinelStats helper), `src/save/{schema,migrations,snapshot}.ts`. +5 new test files (Protocols + Arsenals + Arsenal sim integration), **102/102 passing**.

### Phase 11 — Boons, Heirlooms, Constructs
All three systems shipped end-to-end, each with real sim/stat impact.

**Boons** (`src/meta/boons.ts`) — 12 starter mid-run Boons across three flavors: STAT (Overclocked Core, Kinetic Drive, Extended Reticle, Armor Plating, Ironclad, Vampiric Coil, Runner's High), ECON (Scrip Conduit, Alloy Vein, Quartermaster), UTILITY (Emergency Repair full-heal, Purge Protocol drops all enemies to 1 HP). Offered **every 25 Cycles** — three options drawn deterministically via `run.rng` from the set of not-yet-chosen Boons. **Sim freezes while an offer is pending** (`simulateTick` short-circuits on `run.boons.pending`), so the player can decide at leisure without losing HP. The new `applyBoons` step runs AFTER Forge in the stat pipeline so its multipliers compound on the already-buffed baseline. Per-run BoonState is serialized in the snapshot so mid-run resume survives.

**Heirlooms** (`src/meta/heirlooms.ts`) — 6 starter Heirlooms (Warmind Relic, Ferrous Heart, Catalyst Seed, Chronometer, Aether Lattice, Argent Coil) across rare/epic/legendary rarities. 6-slot equip strip. Heirlooms layer **FIRST** in the stat pipeline — they're permanent multipliers, so they multiply onto the raw base before Protocols/Augments/Forge compound. Two non-stat pathways: `heirloomResearchMultiplier(slot)` stacks multiplicatively with Project Acceleration in the Research Bay (threaded through `enqueueResearch`, `progressResearch`, `effectiveDurationMs`); `heirloomScripMultiplier(slot)` multiplies into `grantKillRewards`. Heirlooms are granted by the host (Phase 13's Order objectives will drive real granting; Phase 11 only wires the plumbing and lets the dev hooks mark one owned).

**Constructs** (`src/meta/constructs.ts`) — 3 starter Constructs: Storm (timed AoE chain-lightning every 6s → 3 arcs of 35 damage at deterministic PRNG-picked enemies within 220 radius, with short-lived visualizer projectiles), Forge (passive +3 Alloy/Kill via the stat layer), Watch (passive aura that tags enemies within 140 units into a `watchSlowedUntil` map; enemy AI multiplies speed by the slow factor per tick). Single-slot equip at launch; Order Shop in Phase 13 will expand slots. Runtime state (`stormCooldown`, `watchSlowedUntil`) lives on `run.constructs` and is reset on Stage mount (not serialized — trivially recomputed from equipped construct).

**UI** — new `BoonChoiceHost.tsx` full-viewport modal with 3 cards (STAT/ECON/UTILITY flavor badges, color-coded left borders). Mounts automatically when `summary.boonOffer` is non-null; clicking a card dispatches `chooseBoon(id)`. Loadout overlay now has **5 tabs**: Protocols / Arsenals / Augments / Heirlooms / Constructs — Heirloom tab shows a 6-cell slot strip + earned-heirlooms library; Constructs tab shows the 3 drones with equip/unequip toggles.

**Save schema bumped to v5**: `heirlooms` and `constructs` added to SaveSlot; migration `4 → 5` hydrates defaults. Mid-run snapshots serialize `boons.chosen` / multipliers / flatDelta / lastOfferedAtCycle so a paused run with active Boons resumes correctly.

**Stat layer order** (outermost → innermost):
```
base → Heirlooms (×mult) → Protocols → Augments → Constructs → Forge → Boons
```

**Key files**: `src/meta/{boons,heirlooms,constructs}.ts`, `src/ui/screens/BoonChoice.tsx`, `src/ui/screens/Loadout.tsx` (Heirlooms + Constructs tabs appended), `src/store/runStore.ts` (boonOffer/boonsChosen + 3 new actions), `src/meta/buyUpgrade.ts` (extended layer chain), `src/meta/researchBay.ts` (threaded heirloomMult through enqueue + progress), `src/sim/{tick,rewards,enemies/ai}.ts` (Boon pause, scrip multiplier, watch slow), `src/save/{schema,migrations,snapshot}.ts`. +12 new tests (Boons 7, Heirlooms 5), **114/114 passing**.

### Phase 12 — Economy Sources, Achievements, Daily Drop
All three IAP-replacement pathways now live.

**Daily Drop** (`src/econ/dailyDrop.ts`) — 30 Prisms base, step +10 through day 6 (30/40/50/60/70/80), plateau at 100 on day 7. Streak advances on claims made between 20h (grace window for TZ hops) and 48h after the previous claim; above 48h, streak resets to 1. `lifetimeClaimed` counter tracked for future vanity metrics. Status query (`getDailyDropStatus`) surfaces `ready` + `nextStreak` + `payout` or a `readyInMs` countdown.

**Achievement Vault** (`src/econ/achievements.ts`) — 20 launch achievements grouped across combat milestones (cycle-25/50/100/200, first-behemoth, kill-100/1000), progression (first-protocol/arsenal/augment/heirloom/construct, three-protocols-equipped, research-first-project, auto-procurement-t1/t2), economy (earn-1000/10000-alloy lifetime), and boon flow (first-boon, five-boons). Unlocks are separated from claims — claim spends the reward as a distinct action so the player feels the payout. Detection hooks: `checkCycleAchievements` (on Cycle rollover), `checkLoadoutAchievements` (after any equip/level-up), `checkResearchAchievements` (on project completion), `recordAlloyEarned` (called from Stage's alloy-delta watcher), `recordBehemothKill` (fires on Behemoth defeat transition).

**Stratum Milestones** (`src/econ/milestones.ts`) — every 50 Cycles inside a run, the slot is credited with Prisms + Alloy + Cores (and Catalyst at Stratum ≥10). Rewards scale with Stratum (+5 Prisms and +50 Alloy per tier). Walk-forward grant loop so a debug jumpToCycle(250) awards all five 50-cycle thresholds in one call. Milestone state lives on the host (not RunState), reinitialized on Stage mount to avoid re-granting on resume.

**UI** — new `Vault` full-viewport overlay with two tabs, accessible from a new `◆ Vault` pill in the Hangar header. The pill gains a prism-glow + "· DROP" suffix when the Daily Drop is ready. Daily Drop tab shows a 52px prism payout hero, streak-day-N-of-7 sub-label, big CLAIM button, and a 7-rung ladder where past days are prism-outlined, the next ready day gets a cyan halo, and future days are muted. Achievements tab shows 20 tiles in a responsive grid with state styling (locked / unlocked / claimed), a "CLAIM ALL · +NP" header button that aggregates unclaimed rewards, and per-tile CLAIM buttons when ready.

**Save schema bumped to v6**: `dailyDrop` and `achievements` added to SaveSlot; migration `5 → 6` hydrates defaults. Neither field touches the run snapshot (they're slot-level across-all-runs).

**Key files**: `src/econ/{dailyDrop,achievements,milestones}.ts`, `src/ui/screens/Vault.tsx`, `src/ui/screens/Hangar.tsx` (added vault pill + mount), `src/ui/Stage.tsx` (milestone check on cycle rollover, achievement hooks, alloy delta watcher, behemoth-kill transition), `src/save/{schema,migrations}.ts`. +17 tests (Daily Drop 6, Milestones 5, Achievements 6), **131/131 passing**.

### Phase 13 — Order, Warden, Subroutines, Weekly Trials
The single-player conversion layer for the source pack's multiplayer systems.

**The Order** (`src/econ/order.ts`) — weekly objective tracker and solo faction shop. `isoWeek(Date)` produces a year*100+week key stable across sessions and TZs. `recordContribution` accumulates the player's cleared-Cycle count per week. 4-tier weekly chest ladder (100/250/500/750 Cycles) grants Order Marks + Subnodes + Prisms + an Alloy-bonus hint on claim. `claimableTier` exposes the highest tier the player hasn't yet claimed. `rolloverWeek` rolls weekly state forward on Stage mount, resets contribution + claimed tier, and — every 8 weeks — ends the season, auto-converting leftover Order Marks to Prisms at 5:1 and resetting per-season purchase counters. Order Shop ships 6 launch items (two Prism caches, Subnode pack, two Subroutines, one Heirloom) with per-season caps; content grants (Subroutines / Heirlooms) dispatch through host so they can mutate the Warden and Heirloom slot state.

**Warden + Subroutines** (`src/meta/warden.ts`) — AI companion that auto-unlocks at **Stratum 3 / Cycle 100** for 100 Subnodes, granting Strike as a starter Subroutine. 3-slot capacity with escalating Subnode costs (100/200/300). 3 launch Subroutines with deterministic sim effects:
- **Strike** — every 4s fires at the most-damaged enemy for 30+8*L damage plus a short visualizer projectile so the renderer shows the beam
- **Bounty** — each tick, marks non-common enemies within 200 units; marked enemies grant +25+5*L bonus Alloy on death via `wardenAlloyBonus` hooked into `grantKillRewards`
- **Fetch** — 5%/level chance per Behemoth kill to drop +10 Prisms via `wardenOnBehemothKill` (called from Stage's behemoth-defeated transition; roll uses `run.rng` for replay parity)

Runtime state (`strikeCooldown`, `bountyMarked` map) lives on `run.warden` and is lazy-initialized on first tick. Level-up costs scale geometrically (50 * 2^L). Subroutine slots are cleared when unequipping; re-equip auto-removes from any previous slot to prevent duplicates.

**Weekly Trials** (`src/econ/weeklyTrial.ts`) — deterministic seed per ISO week via a fixed 64-bit hash + constant offset (`0xCAFEBABE`), so every install gets the same Trial seed without a backend. Cipher Key bracket table: Cycle 25/50/100/200 → 1/2/3/5 Cipher Keys. `recordTrialRun` updates the per-week record, tracks `attempts`, awards only the **delta** Cipher between the player's previous and new bracket so leaderboard progress grants keys once per tier. Called from Stage on every run-end.

**UI** — Vault overlay extended from 2 tabs to **5 tabs**. New tabs:
- **The Order** — season/week header with Order Marks chip, 4-card tier ladder (LOCKED/READY/CLAIM/CLAIMED states with prism glow on the active-claim tier), Order Shop grid showing cost + season-cap counter per item
- **Warden** — locked view shows eligibility gate + DEPLOY button (disabled when Cycle < 100 or Stratum < 3); online view shows 3-slot grid (with UNLOCK buttons on locked slots) + Subroutine library with LOCKED / LEVEL UP / EQUIP actions
- **Weekly Trial** — 4-cell stats row (week seed as 12-char hex, best cycle, attempts, cipher awarded) + 4 Cipher-Key bracket cards with met/claimed borders

**Save schema bumped to v7**: `warden`, `order`, `weeklyTrial` added to SaveSlot; migration `6 → 7` hydrates defaults.

**Stat + reward wiring**:
- Tick step 8c now runs `evaluateWarden(run, dt)` — Strike + Bounty + Fetch all evaluated deterministically
- `grantKillRewards` adds `wardenAlloyBonus` (Bounty payout) and clears the bounty mark so re-collisions don't double-grant
- `rolloverWeek` fires on Stage mount so an idle player returning after a Sunday transition sees fresh weekly state
- `recordContribution` fires on every Cycle rollover with `cyclesAdded` delta
- `recordTrialRun` fires once on run-end via `defeatCommitted` guard

**Key files**: `src/econ/{order,weeklyTrial}.ts`, `src/meta/warden.ts`, `src/ui/screens/Vault.tsx` (+3 tabs), `src/sim/{tick,rewards}.ts` (Warden tick + Bounty bonus), `src/ui/Stage.tsx` (slot.warden wire-up, Order contribution tracking, Trial recording, Fetch dispatch), `src/save/{schema,migrations,snapshot}.ts`. +18 tests (Order 6, Warden 7, Weekly Trial 5), **149/149 passing**.

### Phase 14 — Fleet Enemies + Archive Tech Tree
Late-game depth lands.

**Fleet enemies** (`src/sim/enemies/definitions.ts`) — three roster archetypes with spec-matching stats:
- **Disruptor** — 20× Drone HP, 2× Drone speed, charges the Sentinel (would disable an Arsenal on impact; Phase 15 polish will wire the disable)
- **Overseer** — 20× HP, 0.5× speed, holds outside normal range via a long `stoppingDistance` (aura HP-buff is planned for Phase 15; it emits a soft red ring visually)
- **Resonant** — 20× HP, 1× speed, ranged with slow glowing projectiles (compound-damage mechanic deferred)

`FLEET_ARCHETYPES` set + `isFleet(archetype)` helper drives every immunity check. `fleetSpawnedThisCycle` flag on `run.spawnerState` gates one-fleet-per-Cycle spawn. Demo-friendly schedule: first fleet Cycle at **150**, then every **50** Cycles, rotating D/O/R deterministically. Full spec calibration (first Cycle 15 000) is a Phase 17 balance pass.

**Fleet immunities + drops**:
- Stasis Field applies **half duration** to fleet enemies (per spec §10 50% stasis resistance)
- Thorns/Pulse/Repulse/Singularity immunities are no-ops while those systems aren't wired (Arsenals Phase 10 shipped only 3 of 9)
- On fleet kill, roll `run.rng`: 80% → +3 Flux Crystals, 20% → +1 Augment Fragment. Run-owned accumulator `run.fleetDrops` drains into slot currencies in the summary tick.

**Archive tech tree** (`src/meta/archive.ts`) — 3 branches × 3 tiered nodes = 9 nodes spent with Cipher Keys (1/2/4 per tier). Branches:
- **Harmony** — each tier adds a Protocol slot (3→4→5→6), calling `onPurchase` to extend `slot.protocols.unlockedSlots` and push a new null into `equipped`
- **Ward** — +10% max health / +5% defense / +10 thorns + 2% lifesteal
- **Tactician** — +10% Scrip Bonus / +2 Alloy/Kill / +10% damage

Nodes enforce in-branch-tier prerequisites (`isNodeAvailable` checks the previous tier is owned). Stat-layer nodes call `applyArchiveStats` inside `recomputeSentinelStats`, layered **below** Heirlooms so Heirloom multipliers still compound on top.

**Save schema bumped to v8** with `7 → 8` migration hydrating `archive`.

**Stat layer order** (updated): `base → Archive → Heirlooms → Protocols → Augments → Constructs → Forge → Boons`.

**UI** — Vault overlay gains a 6th tab, **Archive**. Header chip shows Cipher Key count; 3-column branch grid with name + blurb + 3 nodes per column. Nodes render as locked (dashed) / ready (cipher-gold left stripe) / owned (prism left stripe), with UNLOCK / INSUFFICIENT / LOCKED action labels.

**Key files**: `src/meta/archive.ts`, `src/sim/enemies/definitions.ts` (DISRUPTOR/OVERSEER/RESONANT + fleet helpers), `src/sim/enemies/spawner.ts` (fleet spawn hook), `src/sim/{rewards,arsenals}.ts` (fleet drops + stasis half-duration), `src/sim/types.ts` + `src/sim/runState.ts` (fleetDrops accumulator + archive ref), `src/meta/buyUpgrade.ts` (Archive in stat pipeline), `src/ui/screens/Vault.tsx` (Archive tab), `src/ui/Stage.tsx` (fleet drops drain + archive attach), `src/save/{schema,migrations,snapshot}.ts`. +12 tests (Archive 7, Fleet scheduling 5), **161/161 passing**.

### Phase 15 — Tablet Polish + Performance
Late-game performance wins + accessibility surface.

**Spatial hash** (`src/sim/spatialHash.ts`) — grid-indexed broadphase for enemy lookups. Cell size 80 world units (≈ 2× Hulk radius). Rebuilt once per tick at step 3 in `simulateTick` so every downstream query (firing, projectile collision, future arsenals) sees current positions. Two query APIs:
- `queryRadius(cx, cy, r, out)` — fills an out-param scratch buffer with every enemy inside `r`; pre-filters by squared distance; skips dying enemies. Zero per-call allocation.
- `queryNearest(cx, cy, maxRadius)` — expanding-ring search from the center cell outward, early-exits once the best candidate's distance can't be beaten by outer rings.

Wired into:
- Sentinel `acquireTarget()` — now O(1)-ish per shot instead of O(N)
- `resolveProjectileHits()` — uses a module-level `HIT_SCRATCH` buffer (no per-projectile allocation) and queries a tight radius around each projectile instead of scanning all enemies

**Perf smoke** (`src/sim/perf.test.ts`) — 600 sim ticks at Cycle 500 with a full 600-enemy spawn budget runs in ~25ms on the dev box; test bound is 3s so CI stays green under variance. Previous O(P × E) pass would have been seconds at this count.

**Settings overlay** (`src/ui/screens/Settings.tsx`) — new full-viewport screen accessible from a `⚙ Settings` pill in the Hangar header. Sections:
- **Accessibility** — Reduced motion toggle, Low VFX mode toggle, Color-blind palette (Default / Deuteranopia / Protanopia / Tritanopia)
- **Audio** — Master volume slider (reserved; Phase 16 wires Howler.js), Mute auto-buy blip toggle

`applySettingsSideEffects()` mutates `<html>` classes + `data-palette` attribute on every change, so CSS can respond without a React re-render:
- `html.reduced-motion *` → `animation-duration: 0ms` (blanket disables all keyframes including `defeatFade`, `railPulse`, `lcPulse`, `autopulse`, `counterFlash`)
- `html.low-vfx *` → strips `box-shadow` / `filter` on hot effect surfaces (`.arsenal-cd`, `.rb-dot`, `.lc-ring`, `.df-fragments`, `.cs-tick.current`)
- `html[data-palette="deuteranopia"|"protanopia"|"tritanopia"]` → overrides `--threat`, `--threat-hot`, `--prism`, `--cyan` tokens so every color-coded element remaps automatically

Side effects also fire on slot pick (from `SaveSlots.tsx`) and Hangar mount, so palette/VFX state is consistent across every route transition.

**SettingsState** extended with `colorBlindPalette` + `muteAutoBuy`. Migration `8 → 9` hydrates these two fields on older saves.

**Tablet audit** — touch targets in Settings meet the 44px spec (toggles are 44×24, pills are ≥44px tall). Below 1280px viewport the `.screen-body` grid falls back to 2 columns via the existing `@media (max-width: 1279px)` block. Loadout and Vault tabs inherit the same fallback through the shared `.screen-body` shell.

**Save schema bumped to v9** with `8 → 9` migration (settings-only).

**Key files**: `src/sim/spatialHash.ts`, `src/sim/perf.test.ts`, `src/ui/screens/Settings.tsx`, `src/sim/{tick,sentinel/firing,projectiles}.ts` (hash rebuild + query calls), `src/sim/{types,runState}.ts` (enemyHash reference), `src/ui/screens/{Hangar,SaveSlots}.tsx` (Settings pill mount + side-effect apply), `src/styles/overlays.css` (settings UI + palette / reduced-motion / low-VFX CSS), `src/save/{schema,migrations}.ts`. +6 tests (spatialHash 5, perf smoke 1), **167/167 passing**.

### Phase 16 — Settings polish + Tauri distribution + PWA update flow
Ship-ready desktop + web distribution.

**Settings overlay extensions** (`src/ui/screens/Settings.tsx`) — grew from 2 sections to **4 sections** with 13 rows:
- **Accessibility**: reduced-motion toggle, low-VFX toggle, color-blind palette dropdown (Default / Deuteranopia / Protanopia / Tritanopia)
- **Audio**: Master volume + Music volume + SFX volume (3 independent buses; Master is a reserved global attenuator), mute-auto-buy-blip toggle
- **Input**: 4 rebindable keys (Pause, Speed Up, Open Loadout, Open Research Bay) + Gamepad deadzone slider
- **Telemetry**: opt-in anonymous telemetry toggle (default OFF per the no-tracking promise)

New `KeyBinder` component captures the next `keydown` after click; Esc cancels the capture without binding; `↺` reset button per-bind. Displays the bound `KeyboardEvent.code` (e.g. `KeyL`, `BracketRight`) in a monospace chip.

**SettingsState schema extended** with `musicVolume`, `sfxVolume`, `telemetryOptIn`, `keyBindings` (5 named action slots, each `string | null`), `gamepadDeadzone`. Migration `9 → 10` seeds music + sfx from legacy `audioVolume`, defaults telemetry to OFF, hydrates empty keybindings.

**PWA update flow** (`src/ui/PwaUpdateBanner.tsx`) — lazy-imports `virtual:pwa-register` only in production web builds (not Vitest, not Tauri, not dev). Registers a service worker that calls `onNeedRefresh` when the build behind `dist/` changes; banner renders "UPDATE · A new build is ready. Reload to apply?" with `Later` / `Reload now` pills. Reload calls `updateSW(true)` which skip-waits the new SW then reloads the tab. Dedicated `vite-plugin-pwa/client` triple-slash reference added to `vite-env.d.ts` so TS picks up the virtual-module types.

**Tauri distribution** (`src-tauri/tauri.conf.json`) — bundle config expanded from `"all"` to explicit cross-platform targets: `msi` + `nsis` (Windows), `dmg` + `app` (macOS), `deb` + `appimage` (Linux). Added category + short/long descriptions for installer metadata, Windows WiX locale, macOS minimum-system `11.0`, Linux `deb` depends on `libwebkit2gtk-4.1-0` + `libgtk-3-0`. Stub `updater` plugin config with `active: false` (pointing at a placeholder endpoint so Phase 17 can flip the switch after signing keys are provisioned).

**package.json scripts** — added `tauri:build:win`, `tauri:build:mac`, `tauri:build:linux` pinning bundles per OS, plus `typecheck` / `lint` aliases so CI can run `npm run typecheck` without remembering the tsc flag.

**Save schema bumped to v10** with `9 → 10` migration (settings-only, non-breaking).

**Key files**: `src/ui/screens/Settings.tsx` (4 sections + KeyBinder), `src/ui/PwaUpdateBanner.tsx`, `src/App.tsx` (banner mounted on every route), `src/styles/overlays.css` (banner + keybind CSS), `src/save/{schema,migrations,settingsMigration.test.ts}`, `src-tauri/tauri.conf.json` (expanded bundle config + updater stub), `package.json` (per-OS build scripts), `src/vite-env.d.ts` (PWA client types). +2 tests (settings migration), **169/169 passing**.

### Phase 17 — Closed alpha → open beta
Alpha-ready distribution surface + Main Menu + opt-in telemetry.

**Main Menu** (`src/ui/screens/MainMenu.tsx`) — new default route `"main-menu"` ahead of the slot picker. 220px logo with cyan glow, tagline, stacked button column:
- **Play** (cyan primary) → slot picker
- **Settings** → loads the last-used slot's settings and opens the existing overlay; disabled if no profile exists
- **About** → in-place modal with version + 3 sections (Identity / Tech / Credits), Esc-closes
- **Quit** (threat-red, Tauri-only) → `getCurrentWindow().close()` via dynamic-imported `@tauri-apps/api/window`; hidden on web

Back-navigation pills wired on every downstream route: Title has "↩ Main Menu · Esc", Hangar has "⌂ Menu", in-run TopBar has "⌂ Menu" next to "↩ Hangar". Esc on the Title returns to the Menu.

**Platform module** (`src/platform/quit.ts`) — `isTauri()` probes `__TAURI_INTERNALS__` / `__TAURI__` globals; `quitApplication()` lazy-imports the Tauri window API so the web bundle doesn't pull it.

**Brand asset** — user-provided logo rasterized through `npx @tauri-apps/cli icon` → full Tauri + iOS + Android icon set regenerated. Favicon / apple-touch-icon / PWA-manifest icons populated in `app/public/` (128/256/512 + 32px favicon). Inline hex-SVG logos in TopBar / SaveSlots / Hangar replaced with `<img src="/icon-128.png">` wrapped in a new `.logo-img` CSS class. PWA manifest `icons[]` includes a `maskable` variant for Android adaptive icons.

**Opt-in telemetry** (`src/platform/telemetry.ts`) — no-network, local-only event queue. `setTelemetryEnabled(on)` toggles capture; events are queued in-memory and mirrored to `localStorage['sentinel-ascent/telemetry']` with a 500-event cap + schema version. `installCrashHandlers()` wires `window.error` + `unhandledrejection` + `beforeunload` into the queue. Event kinds: `session-start`, `session-end`, `run-start`, `run-end`, `cycle-milestone`, `behemoth-killed`, `boon-chosen`, `protocol-equipped`, `arsenal-acquired`, `research-completed`, `fleet-encountered`, `defeat`, `crash`, `warning`. Each install gets an 8-byte random correlation id (no PII).

`downloadTelemetry()` builds a stamped JSON blob and triggers a browser download; `clearTelemetry()` drains the queue. Both surface as buttons in **Settings → Telemetry** when opt-in is on, alongside an `N events` counter. Toggle OFF wipes both the queue and the storage key.

**Stage instrumentation** — `run-start` on Stage mount, `run-end` + `defeat` on the first post-`ended` tick, `cycle-milestone` every 25 cycles, `behemoth-killed` on the behemoth-defeated transition. All routed through the opt-in guard so opted-out players emit zero events.

**Balance calibration pass** — per economy doc §19 target (~150 Prisms/day for 30 min/day playtime):
- Daily Drop: 30→100 across 7-day streak — already in place (avg ~65/day once streaked)
- Achievement Vault: 20 achievements summing to **665 Prisms** across the first week → **~95/day**
- Stratum Milestones: **+25** Prisms per 50-Cycle threshold + Stratum bonus
- Added **+1 Prism per Behemoth kill** (economy doc §4: "small Prism chance on every Behemoth kill") — lands 6-10/day at mid-game cadence
- Sum: ~65 + 15 (achievements amortized after week 1) + 25 + 6 = **~110/day steady state**, rising with engagement (Order chests, Weekly Trial placements, Fleet drops) — consistent with the §19 target.

**Beta tester guide** — new `docs/my_game/13-beta-tester-guide.md` covers install per platform (PWA + Windows MSI + macOS DMG + Linux DEB/AppImage), first-session checklist, progression gates reference table, known Phase-17 limitations, bug-report workflow (opt in → reproduce → download JSON → attach), and the full privacy breakdown (what telemetry contains: install id, event kinds, truncated UA, no PII).

**Key files**: `src/platform/{quit,telemetry,telemetry.test}.ts`, `src/ui/screens/MainMenu.tsx`, `src/ui/screens/Settings.tsx` (telemetry section + download actions), `src/ui/Stage.tsx` (4 telemetry events + Behemoth Prism drop), `src/main.tsx` (installCrashHandlers bootstrap), `src/App.tsx` (main-menu route), `src/store/appStore.ts` (route enum + default), `src/ui/screens/{SaveSlots,Hangar}.tsx` + `src/ui/TopBar.tsx` (back-to-menu pills), `app/public/icon-*.png` + `favicon.*` + `apple-touch-icon.png`, `index.html` (favicon links), `vite.config.ts` (PWA manifest icons[]), `src-tauri/icons/*` (regenerated), `src-tauri/tauri.conf.json` (icon refs unchanged), `docs/my_game/13-beta-tester-guide.md`. +4 tests (telemetry 4), **173/173 passing**.

## Save schema

**Current version: 10**

```
SaveSlot {
  schemaVersion: 3
  slotId, profile, currencies (11 currencies), settings, metadata
  metaForge: null                // reserved for later phase
  researchBay: ResearchBayState  // added in Phase 6 (v2)
  selectedStratum, runsLaunched, lastRun  // added in Phase 7 (v3)
  protocols, arsenals, augments  // added in Phase 10 (v4)
  heirlooms, constructs          // added in Phase 11 (v5)
  dailyDrop, achievements        // added in Phase 12 (v6)
  warden, order, weeklyTrial     // added in Phase 13 (v7)
  archive                        // added in Phase 14 (v8)
  settings.colorBlindPalette/muteAutoBuy  // added in Phase 15 (v9)
  settings.musicVolume/sfxVolume/telemetryOptIn/keyBindings/gamepadDeadzone  // added in Phase 16 (v10)
  runSnapshot: RunSnapshot | null
}

RunSnapshot {
  seed + rngState (BigInts as strings)
  cycle, tick, cycleProgress, cycleEnemyBudget, spawnerState
  scrip, alloy
  baseSentinelStats + sentinelStats
  enemies[], projectiles[], enemyProjectiles[]
  forge.levels
  autoProcurement { unlockedTier, activeTier, tier1, tier2 }
  stratum, stratumScale
  stats { kills, damageDealt }     // added in Phase 8 (non-breaking: optional)
  startedAt
}
```

Migrations registered: v0→v1 (none), v1→v2 (hydrate researchBay), v2→v3 (hydrate selectedStratum/runsLaunched/lastRun), v3→v4 (hydrate protocols/arsenals/augments), v4→v5 (hydrate heirlooms/constructs), v5→v6 (hydrate dailyDrop/achievements), v6→v7 (hydrate warden/order/weeklyTrial), v7→v8 (hydrate archive), v8→v9 (extend settings with colorBlindPalette + muteAutoBuy), v9→v10 (split audio into music/sfx buses + add telemetry/keybindings/gamepad).

## Design system

[10-design-system.md](10-design-system.md) is the **locked** source of truth. All CSS tokens live in `src/styles/tokens.css`. Shell grid is `72px | 1fr | 400px × 52px | 1fr | 88px` on PC, with a single tablet fallback under 1280 px. Typography: Inter for UI, JetBrains Mono for all numbers with `tabular-nums`.

## What's intentionally not yet built

- **Hangar loadout chips** — still show "Unassigned" placeholders; the source of truth is now the in-game Loadout overlay. Phase 11+ can connect the Hangar preview to live loadout state.
- **Augment affix / rarity / reroll system** — the Augments skeleton ships without rolled affixes; full rarity tree is deferred to a polish phase
- **Construct earning source** — Constructs still only surface via dev hooks; Phase 12's achievement rewards + future Order Shop expansions could grant them
- **Ghost-replay export** — Weekly Trial spec allows JSON ghost replays; deferred to Phase 17 polish
- **Full economy** (Phase 12) — only Alloy + Scrip flow in-run; Prisms/Catalyst/Cores/Insignia plumbed but don't yet accumulate from gameplay
- **Order / Warden / Weekly Trials** (Phase 13)
- **Fleet enemies + Archive tech tree** (Phase 14)
- **Tablet/perf polish, Tauri packaging, Settings, Accessibility** (Phases 15–16)

Nothing is broken — these are absent by design per the roadmap's vertical-slice approach.

## Key architectural decisions

1. **Determinism from day 1.** Every RNG draw uses the run's seeded PRNG. `RunSnapshot` captures rngState. Tests prove snapshot → resume → output matches continuous simulation.
2. **Sim/render decoupled.** Sim runs at fixed 60 Hz; render at display refresh with `alpha` interpolation. World-fit scaling applied per-frame for smooth viewport changes.
3. **Single input bus (future).** Not yet built, but layout assumes touch + mouse feed the same event bus.
4. **DOM HUD over PixiJS canvas.** React does the chrome; PixiJS does the Grid only. Zustand stores project RunState to a HUD-friendly cadence (~10 Hz) so React doesn't re-render every sim tick.
5. **Save first.** Every breaking change requires a schema bump + migration. Saves are crash-safe via staging-key atomic swap.
6. **Design tokens locked.** No hardcoded colors. Every `#xxxxxx` in CSS lives in `tokens.css`.
7. **StrictMode disabled in dev.** Re-enable only after Stage's lifecycle is fully StrictMode-safe (currently the double-mount churns the WebGL context).

## Chrome testing setup

Chrome MCP is connected. The user's workflow for key milestones:

```
npm run dev &                                   # boot Vite at :5173
mcp__Claude_in_Chrome__tabs_context_mcp(...)    # get a tab
mcp__Claude_in_Chrome__navigate(http://localhost:5173/)
mcp__Claude_in_Chrome__resize_window(1440x900)
mcp__Claude_in_Chrome__computer(screenshot)     # visual check
mcp__Claude_in_Chrome__find("element query")    # semantic DOM ref
mcp__Claude_in_Chrome__javascript_tool(...)     # poke state / use __sa hooks
```

Preview (`mcp__Claude_Preview__*`) is used for fast iteration; Chrome for real-browser validation at milestones.

## Getting back to work

If picking this up in a new session:

1. Read this file + [11-build-roadmap.md](11-build-roadmap.md) §Phase 8
2. `cd app && npm install && npm run test` → confirm 73/73
3. `npm run dev` → confirm visual at `:5173`
4. Phase 8 starts at: spec in [10-design-system.md](10-design-system.md) §6.3 (Defeat overlay) + roadmap Phase 8. Current placeholder is in `src/ui/Stage.tsx` `StageHud` component ("SENTINEL DOWN · PHASE 8 WILL ADD THE DEFEAT OVERLAY").
