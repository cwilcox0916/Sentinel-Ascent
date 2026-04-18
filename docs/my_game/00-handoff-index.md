# Sentinel Ascent — Handoff Pack

This folder is the implementation-facing design pack for `Sentinel Ascent`, a single-player radial survival-defense incremental game built for **PC and tablet** with no microtransactions.

It is the sister pack to `docs/main_game/`, which captures the design of a published mobile game in the same genre. The pack you are reading reuses the structural design lessons from that source, then renames every proper noun for IP safety, replaces every monetization pathway with in-game progression, and adds two systems the source pack does not cover: a **5-slot save system** and a **researchable auto-buy system** for in-run upgrades.

The goal is the same as the source pack: another model (or a small dev team) should be able to read this folder cover to cover and start implementing without further research.

## Confidence Labels

The same labelling convention as the source pack is used so cross-references stay clean:

- `Verified`: structural rule imported from the source pack and preserved here
- `Observed`: visible in the source game footage and screenshots
- `Inferred`: implementation guidance, fresh to this pack, not present in source documentation
- `New`: design native to Sentinel Ascent, no source-pack analog (save system, auto-procurement, IAP replacements, single-player conversions)

## Scope

This pack covers:

- Core game loop and run structure
- Battlefield geometry and the simulation tick model
- Sentinel combat, targeting, damage, and defensive systems
- 12 enemy archetypes across Normal / Behemoth / Elite / Fleet bands
- Visual style, HUD layout for both PC mouse/keyboard and tablet touch
- All meta-progression systems (Forge, Research Bay, Protocols, Augments, Boons, Heirlooms, Constructs, Arsenals, Order, Warden + Subroutines, Archive)
- All 11 currencies, their earn paths, and their sinks
- The full microtransaction-replacement table — every IAP/ad source in the source game has a free-progression equivalent here
- A 5-slot save system with schema versioning, mid-run snapshotting, and JSON export/import
- A 4-tier researchable auto-buy system for in-run upgrades
- The chosen tech stack (TypeScript + PixiJS + Tauri/PWA) and the architecture that supports both desktop and tablet from one codebase
- A **locked visual design system** (tokens, layout, components, motion) derived from the approved `Sentinel Ascent HUD.html` prototype — see [10-design-system.md](10-design-system.md)

This pack does **not** cover:

- Final art assets or audio
- Server infrastructure (the design is single-player; weekly trials use deterministic seeded runs and local leaderboards)
- Final balance tables for every level of every upgrade — initial values are seeded; live tuning is expected

## High-Level Identity

Sentinel Ascent is a **radial survival-defense incremental** game.

Core fantasy:

- A stationary defense node — the **Sentinel** — sits at the center of a circular battlefield called the **Grid**
- Hostile waves of drones and constructs approach from beyond the engagement radius
- The Sentinel auto-fires; the player does not aim
- The player spends an in-run currency (**Scrip**) on upgrades that reset at run end
- Outside of runs, layered permanent progression compounds across many systems

Three identity layers (mirroring the source genre):

- **Session layer**: survive cycles, buy in-run upgrades, react to enemy types
- **Meta layer**: compound power across the Forge, Research Bay, Protocols, Augments, Arsenals, Heirlooms, and the Archive tech tree
- **Optimization layer**: route currencies into the highest-value system for the player's current goal — farming, milestone clears, weekly Trials, or the Order's seasonal objectives

## Design Principles To Preserve

- The Sentinel never moves
- The Grid is circular and center-anchored
- Combat is mostly deterministic once stats and RNG seeds are set
- Multiple kill systems overlap: projectile fire, Thorns, Sentries, Charges, the Annihilator Beam, and Arsenals
- Progression is intentionally stacked and long-tail
- The screen must remain readable even at high effect density
- The clone supports active play (PC mouse, tablet touch) **and** passive monitoring (auto-procurement leaves the player free to watch numbers climb)

## What Is New In Sentinel Ascent

These are not present in the source pack. They are documented in dedicated specs.

- **Locked design system** — full tokens (colors, typography, spacing, layout grids), component inventory (chips, rail buttons, upgrade rows, Auto-Procurement panel, tier ladder, Hangar hero blueprint, Defeat overlay), and a complete motion catalogue. The design is **PC-first ≥1280 px full-viewport**, with a single tablet fallback below 1280. The four primary screens (in-run HUD, Research Bay, Hangar, Defeat) are illustrated in the reference prototype `Sentinel Ascent HUD.html`. See [10-design-system.md](10-design-system.md).
- **5-slot save system** — fully isolated profiles, IndexedDB storage, mid-run snapshotting with RNG state, JSON export/import for cross-device migration. See [07-save-system-spec.md](07-save-system-spec.md).
- **Auto-Procurement** — a 4-tier research project that automates in-run upgrade buying. Tier 1 unlocks early (single category), Tier 4 unlocks late (conditional rules engine). See [08-auto-procurement-spec.md](08-auto-procurement-spec.md).
- **Microtransaction replacements** — every IAP/ad pathway from the source game (ad gems, offer walls, real-money currency packs, monthly Core packs, paid lab rushes, gem-walled card slots) is replaced with an in-game progression path. The full replacement table is in [05-currencies-and-economy.md](05-currencies-and-economy.md).
- **Single-player conversions** — Guild → the **Order** (solo seasonal objectives), Guardian → the **Warden** (AI companion auto-unlocked at Stratum 3), Tournaments → **Weekly Trials** (deterministic seeded runs with local leaderboards and shareable JSON ghost replays).
- **Dual-platform input layer** — one input bus serves PC (mouse, keyboard, gamepad) and tablet (touch). HUD layouts adapt by viewport. See [09-input-and-platform-spec.md](09-input-and-platform-spec.md).

## Renaming Index

Every proper noun in the source pack has a renamed equivalent here. The full glossary is in section 2 of [04-progression-systems.md](04-progression-systems.md), but the high-frequency terms are:

| Source pack | Sentinel Ascent |
|---|---|
| The Tower | the **Sentinel** |
| arena | the **Grid** |
| wave | **Cycle** |
| tier | **Stratum** |
| Cash | **Scrip** |
| Coins | **Alloy** |
| Gems | **Prisms** |
| Power Stones | **Cores** |
| Medals | **Insignia** |
| Cells | **Catalyst** |
| Keys | **Cipher Keys** |
| Bits | **Subnodes** |
| Tokens | **Order Marks** |
| Workshop | **Forge** |
| Labs | **Research Bay** |
| Cards | **Protocols** |
| Modules | **Augments** |
| Perks | **Boons** |
| Relics | **Heirlooms** |
| Bots | **Constructs** |
| Ultimate Weapons | **Arsenals** |
| Guild | **Order** |
| Guardian | **Warden** |
| Chips | **Subroutines** |
| Vault | **Archive** |
| Death Ray | **Annihilator Beam** |
| Orbs | **Sentries** |
| Shockwave | **Pulse** |
| Land Mines | **Charges** |
| Wall | **Barrier** |
| Death Defy | **Resilience Surge** |
| Recovery Packages | **Repair Kits** |

## Recommended Reading Order

1. [01-core-runtime-and-combat-spec.md](01-core-runtime-and-combat-spec.md) — what a run looks like and how the combat sim works
2. [02-enemies-and-wave-spec.md](02-enemies-and-wave-spec.md) — the 12 enemy archetypes
3. [03-visual-style-ui-and-feedback.md](03-visual-style-ui-and-feedback.md) — palette, layers, HUD on PC vs tablet
4. [04-progression-systems.md](04-progression-systems.md) — every meta-progression system
5. [05-currencies-and-economy.md](05-currencies-and-economy.md) — currencies, sinks, and the IAP-replacement table
6. [06-architecture-and-tech-stack.md](06-architecture-and-tech-stack.md) — TypeScript / PixiJS / Tauri / PWA stack and module layout
7. [07-save-system-spec.md](07-save-system-spec.md) — 5-slot save system
8. [08-auto-procurement-spec.md](08-auto-procurement-spec.md) — 4-tier auto-buy research
9. [09-input-and-platform-spec.md](09-input-and-platform-spec.md) — input handling and platform differences
10. [10-design-system.md](10-design-system.md) — **locked** design tokens, layout grids, components, and motion (single source of truth for visual identity)
11. [11-build-roadmap.md](11-build-roadmap.md) — phased implementation plan from empty repo to shippable v1.0
12. [12-progress-log.md](12-progress-log.md) — **what's actually built right now** (companion to the roadmap; updated per phase)

## Recommended Build Order (MVP First)

A faithful MVP can ship with these systems before any of the late-game depth:

1. Sim loop, Grid render, Sentinel core with range circle
2. **Drone**, **Skimmer**, **Hulk**, **Lancer** normal enemies; **Behemoth** boss
3. Forge upgrades for: Damage, Attack Speed, Range, Health, Defense %, Thorns, Repulse, Sentries, Lifesteal, Scrip Bonus, Alloy/Kill Bonus
4. Scrip (run currency) and Alloy (permanent currency)
5. Research Bay (one tab), Protocols (one slot), Boons (one mid-run choice), 3 starter Arsenals
6. Behemoth waves
7. Floating Prism pickups
8. **5-slot save system** (cannot ship without this)
9. **Auto-Procurement Tier 1** (cannot ship without first tier — the user requested this as a core feature)

After MVP, layer on:

- Elites (Aegis, Leech, Splitter, Lance)
- Augments and the Augment / Flux economy
- Weekly Trials and Insignia
- Cores and the rest of the Arsenals
- Heirlooms and Constructs
- The Order and Warden + Subroutines
- Fleet enemies (Disruptor, Overseer, Resonant)
- Archive tech tree and Cipher Keys
- Auto-Procurement Tiers 2, 3, 4 (each gated by Stratum milestone)

## Quality Bar

The clone is in the right place when:

- A new player sees "central defender holding off a swarm" within 5 seconds of starting
- All overlapping kill systems remain readable on screen at high effect density
- The Auto-Procurement system can be ignored entirely (manual play remains satisfying) but, once researched, is genuinely useful
- A save can be exported on PC, imported on tablet, and resumed mid-run with identical state
- A player who never spends real money never feels gated — every system in the game is reachable through play
