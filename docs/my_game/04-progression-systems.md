# Progression Systems

This document inventories the major permanent and semi-permanent systems that make `Sentinel Ascent` a long-tail incremental game.

> **Visual reference**: meta-progression surfaces (Hangar, Research Bay, Defeat) are designed in [10-design-system.md](10-design-system.md) sections 6.1–6.3. The Hangar is the meta hub — Sentinel selection, Stratum ladder, loadout chips, last-run summary, modifier banner, Launch button.

## 1. Progression Philosophy

`Verified` (genre); `New` (single-player conversions of multiplayer systems)

The game is built around layered progression — not one tree. The player advances through overlapping systems:

- **Forge** — base permanent stat upgrades
- **Research Bay** — timed research projects (also home of **Auto-Procurement**)
- **Protocols** — equipable run modifiers
- **Protocol Slots** — gradual slot expansion
- **Augments** — equipment-style gear pieces
- **Augment Fragments** and **Flux Crystals** — Augment rank/reroll currencies
- **Arsenals** — premium parallel-kill systems
- **Boons** — mid-run choices
- **Heirlooms** — permanent multiplicative bonuses
- **Constructs** — unlockable assist drones
- **Strata** and **Stratum Milestones** — content gates
- **Order** — single-player faction system with seasonal objectives
- **Warden** — AI companion auto-unlocked at Stratum 3
- **Subroutines** — Warden's chip system
- **Archive** — late-game tech tree gated by Cipher Keys

## 2. Renaming Glossary

`New` (full mapping for traceability)

The complete list of renamed proper nouns is in [00-handoff-index.md](00-handoff-index.md#renaming-index). The renaming is final — every other doc in this pack and every UI string in the build should reference these names exclusively.

## 3. Strata And Milestones

`Verified` (renamed)

Runs are performed on **Strata**. Strata are difficulty bands and content gates.

Milestones (Stratum + Cycle achievements) unlock systems. Defaults at launch:

| Unlock | Milestone |
|---|---|
| **Research Bay** | Stratum 1, Cycle 150 |
| **Auto-Procurement Tier 1** (Research Bay project) | Stratum 2, Cycle 100 |
| **Order** (single-player) | Stratum 3, Cycle 10 |
| **Warden** | Stratum 3, Cycle 100 |
| **Auto-Procurement Tier 2** | Stratum 4, Cycle 50 |
| Doubled Annihilator Beam (Research project) | Stratum 3, Cycle 300 |
| **Auto-Procurement Tier 3** | Stratum 7, Cycle 200 |
| Leech-counter Research projects | Stratum 12, Cycle 60 |
| **Auto-Procurement Tier 4** | Stratum 12, Cycle 100 |
| Fleet enemy onset (default) | Stratum 14 |
| **Archive** tech tree | Stratum 15, Cycle 50 |

Initial roadmap: 18 Strata at launch, room to extend to 30.

## 4. Forge

`Verified` (renamed Workshop)

The Forge is the foundational permanent-upgrade system. Three tabs:

- **Attack** — Damage, Attack Speed, Range, Critical Factor, Damage/Meter, Super Crit Multiplier, Rend Max
- **Defense** — Health, Health Regen, Defense %, Defense Absolute, Thorns, Lifesteal, Repulse Chance, Repulse Force, Sentry Speed, Sentries, Pulse Size, Pulse Frequency, Charge Chance, Charge Damage, Charge Radius, Resilience Surge, Barrier Health, Barrier Rebuild
- **Utility** — Scrip Bonus, Scrip/Cycle, Alloy/Kill Bonus, Alloy/Cycle, Free Upgrades, Interest/Cycle, Repair Kits, Cycle Skip

Forge upgrades are bought with **Alloy**. They define the baseline ceiling for in-run upgrades.

## 5. Research Bay

`Verified` (renamed Labs); `New` (Auto-Procurement is housed here)

The Research Bay holds **timed research projects**. Each project costs Alloy (and sometimes Catalyst) and runs in real time.

Key properties:

- Unlocks at Stratum 1 / Cycle 150 milestone
- Multiple Research Slots (slot count expands via Prisms)
- Game-speed projects (1× → 3×)
- **No paid rush** — the source genre uses premium currency to skip research; Sentinel Ascent uses an **Overclock** project line instead (passive, permanent research-speed multiplier, bought with Alloy)
- A dedicated **Project Acceleration** project line exists separately (the equivalent of "Lab Speed", with 99 levels)
- Project Acceleration multiplies with Heirloom-based research-speed bonuses

The Research Bay also hosts the **Auto-Procurement** project tree — a 4-tier unlock that automates in-run upgrade purchasing. See [08-auto-procurement-spec.md](08-auto-procurement-spec.md).

## 6. Protocols

`Verified` (renamed Cards)

Protocols are equipable run modifiers.

- Each Protocol costs **10 Prisms** to acquire (the source pack's premium-currency cost is halved here because there are no IAP top-ups)
- Buying a Protocol grants a copy used for level-up
- Protocols max at **level 7**
- Protocols are equipped into Protocol Slots
- The number of equipped Protocols equals the number of unlocked slots
- Behemoths and fleet enemies **lock the Protocol panel** while alive — equipment cannot change

### Protocol Slot expansion

The first slot is free; further slots are unlocked through the **Archive** tech tree (Cipher Key currency). This is a **departure from the source genre**, which sells slots for premium currency. The change protects the no-microtransaction promise without removing the slot expansion as a long-tail goal.

| Slot # | Source-pack cost | Sentinel Ascent unlock |
|---|---|---|
| 2 | 50 Gems | Archive: 1 Cipher Key |
| 3 | 100 Gems | Archive: 2 Cipher Keys |
| 4–10 | escalating Gems | Archive: escalating Cipher Keys |
| 11–22 | escalating Gems | Archive: escalating Cipher Keys |
| 23–28 | tech-tree gated | Archive: deep Harmony branch |

Maxing one Protocol still requires **80 copies** total. Protocol copies also drop from Behemoth kills (a non-source addition that prevents progression from feeling Prism-bound).

## 7. Boons

`Verified` (renamed Perks)

Boons are mid-run choices that shape the current session.

- Add roguelite variance to otherwise deterministic farming
- Let the player pivot toward economy, damage, control, or survival
- Create per-run identity beyond the permanent build
- Surfaced at preset Cycle intervals (default: every 25 Cycles, with three offered, one chosen)
- Pool of ~40 Boons at launch

## 8. Arsenals

`Verified` (renamed Ultimate Weapons)

Arsenals are the premium, highly visible, major-power system. Bought and upgraded with **Cores**.

The 9 Arsenals are listed in section 11 of [01-core-runtime-and-combat-spec.md](01-core-runtime-and-combat-spec.md).

Shared rules:

- All owned Arsenals can be slotted into the same run
- They auto-fire when their cooldown reaches zero
- Cooldown resets immediately on activation, even while the active window is still open
- They can be toggled on/off mid-run
- Toggle count per run is capped (default 5)

Important design note: Arsenals are not all damage. Some are economy (Resonance Surge), some are control (Stasis Field, Singularity), some are vulnerability amplifiers (Marker Beacon). The mix creates layered late-game builds.

## 9. Augments

`Verified` (renamed Modules)

Augments are equipment-style gear pieces with rerollable stat lines.

System anatomy:

- Augment slots on the Sentinel (4 starting; expandable through Stratum challenges)
- Each Augment has a base identity (e.g., "Magnetic Hook" — pulls a designated enemy each Cycle)
- Each Augment has 2–4 rollable stat affixes
- **Augment Fragments** — rank up an Augment's level
- **Flux Crystals** — reroll a single affix slot
- **Epic Augments** have unique on-equip effects that other rarities lack

> Source-pack note: in the source game, Augment-equivalent items can be bought with premium currency. In Sentinel Ascent, **Augments are earned via Stratum challenge completions and Behemoth/fleet drops only**. See [05-currencies-and-economy.md](05-currencies-and-economy.md) section 10.

## 10. Heirlooms

`Verified` (renamed Relics)

Heirlooms are permanent multiplicative bonuses earned through Order seasonal objectives, Weekly Trial top-placings, and event-style limited campaigns.

Key example: Heirloom bonuses to research speed stack **multiplicatively** with the Research Bay's Project Acceleration line (matching source-pack design intent).

## 11. Constructs

`Verified` (renamed Bots)

Constructs are unlockable assist drones, bought from the **Order Shop** (with Order Marks) or earned via Stratum milestones.

Examples planned at launch:

- **Storm Construct** — periodic chain-lightning assist
- **Forge Construct** — passive Alloy/Kill bonus while equipped
- **Watch Construct** — slows nearby enemies in a small radius

Some Construct-related interactions are referenced in fleet resistance data (e.g., fleet enemies have 50% resistance to "Thunder Construct" stun).

## 12. The Order (Single-Player Conversion of Guilds)

`New` (single-player replacement for source-pack Guilds)

The Order is a **solo faction system** — there is no real-time multiplayer.

Mechanics:

- Unlocks at Stratum 3, Cycle 10 (matches source-pack Guild unlock for parity)
- The player joins one of three Orders (cosmetic affiliation, no PvP)
- Weekly objectives generate **Order Marks**
- Seasonal rotation: 8 weeks per season
- End-of-season auto-conversion: leftover Order Marks → Prisms at 5:1 (rounded up)
- The Order Shop sells: Prisms, Subnodes, Augment Fragments, Heirlooms, Constructs, cosmetic Themes, Subroutines

Weekly objective ladder (sample Cycle-completion contribution):

| Personal contribution | Weekly chest |
|---|---|
| 100 | 10 Order Marks, 10 Subnodes, 1× Alloy bonus, 5 Prisms |
| 250 | 20 Order Marks, 25 Subnodes, 2× Alloy bonus, 10 Prisms |
| 500 | 40 Order Marks, 50 Subnodes, 3× Alloy bonus, 15 Prisms |
| 750 | 80 Order Marks, 100 Subnodes, 5× Alloy bonus, 30 Prisms |

Weekly maxima: 150 Order Marks, 185 Subnodes, 11× Alloy bonus, 60 Prisms (preserved from source-pack Guild ladder so the original economy pacing carries over even without other players).

Order Shop pricing samples per season:

- Prisms: up to 3 buys/season at 15 / 25 / 40 Order Marks
- Subnodes: up to 3 buys/season at 25 / 50 / 75 Order Marks
- Subroutines: 200 Order Marks each
- Heirlooms: 75 and 150 Order Mark price points
- Themes (Sentinel skin, Background, HUD chrome, Warden skin): 100 / 100 / 100 / 150 Order Marks

## 13. Warden And Subroutines (Single-Player Conversion of Guardian + Chips)

`New` (Warden auto-unlocks; no Guild dependency)

The Warden is an AI companion that auto-unlocks at Stratum 3 / Cycle 100. The player does **not** need any social system to access it.

- Subnodes unlock the Warden and additional Subroutine slots
- Subroutines are upgraded with Subnodes
- Some Subroutines are bought with Order Marks

Subroutine unlock costs:

- Warden + first Subroutine slot: 100 Subnodes
- 2nd slot: 200 Subnodes
- 3rd slot: 300 Subnodes

Subroutines (launch set):

- **Ally** — converts an enemy into a Repair Kit that can heal beyond the normal Repair-Kit cap
- **Strike** — Warden attacks nearby enemies based on damage already dealt to them
- **Bounty** — marks nearby non-common enemies to grant more Alloy on death
- **Fetch** — retrieves hidden loot (Alloy, Prisms, Insignia, Augment Fragments, Augments)
- **Scout** — makes enemies count as farther from the Sentinel for damage calculations
- **Summon** — spawns extra enemies and applies a Scrip bonus while active

## 14. Archive (Tech Tree)

`Verified` (renamed Vault)

The Archive contains tech-tree branches purchased with **Cipher Keys**.

- Cipher Keys are earned by placing in the top 15 of the **Weekly Trial** (the single-player replacement for tournaments — see section 16)
- Cipher Keys buy unique Sentinel upgrades inside Archive branches
- The **Harmony branch** can extend Protocol Slot count beyond the Archive base path
- Other branches (sample): Velocity (movement-speed-related Sentry effects), Ward (Barrier scaling), Tactician (Boon variety + reroll)

## 15. Daily Tasks And Weekly Rewards

`Verified` (renamed Daily Missions)

Daily Tasks are recurring objectives that feed multiple currencies — Prisms, Cores, Insignia, and small Alloy bumps.

Weekly Reward chests roll up Daily Task completion across the week.

## 16. Weekly Trials (Single-Player Conversion of Tournaments)

`New` (no servers required — deterministic seeded runs + local leaderboard + JSON ghost replays)

Weekly Trials replace the source pack's Tournaments.

- A single weekly seed is published in the build's content (or, optionally, fetched from a static JSON URL with no auth)
- Every player runs the same seeded build environment with their existing meta-progression intact
- Top placement granting Cipher Keys: simulated by mapping the player's Cycle reach to a fixed reward table (no other player needed)
- Optional: export a "ghost" JSON of a Trial run; players can share these out-of-band; importing one shows a translucent ghost on the Grid replaying that run for comparison

This preserves the **Tournament currency loop** (Cores, Cipher Keys) without any backend.

## 17. Themes And Cosmetics

`Verified` (renamed)

Themes exist for:

- Sentinel skin
- Grid background
- HUD chrome
- Warden skin
- Music pack

All Themes are earnable through Order Marks, Achievements, or Stratum milestones. **No Theme is locked behind real money.**

## 18. Progression Dependency Graph

`Inferred` (single-player adapted)

```
Runs ──► Scrip (in-run only)
       └► Alloy ──► Forge, Research Bay, Augment ranks
       └► Prisms ──► Protocols, Research Slots, Game Speed projects
       └► Cores ──► Arsenals
       └► Catalyst ──► Advanced Research projects
       └► Augment Fragments + Flux Crystals (from fleet) ──► Augments
       └► Insignia (from event-style campaigns) ──► Order Shop alternate buys

Order activity ──► Order Marks ──► Order Shop
                └► Subnodes ──► Warden + Subroutines

Weekly Trial placement ──► Cipher Keys ──► Archive tech tree
                        └► Cores

Stratum Milestones ──► Augment slot unlocks, Construct unlocks, Auto-Procurement tier unlocks
```

## 19. Build Order Recommendation

For an LLM or small team building this:

1. **Forge**
2. **Research Bay** + **Auto-Procurement Tier 1** (the user requires this for MVP)
3. **5-slot save system** (the user requires this for MVP — see [07-save-system-spec.md](07-save-system-spec.md))
4. **Protocols** + first three Slots
5. **Boons**
6. **Arsenals** (start with three)
7. **Augments** + Fragment/Flux economy
8. **Insignia** + event-style Daily/Weekly Tasks
9. **Weekly Trials** + **Cores**
10. **Heirlooms**
11. **Order**, **Warden**, **Subnodes**, **Order Marks**, **Subroutines**
12. **Archive** + **Cipher Keys**
13. Fleet enemies (Disruptor, Overseer, Resonant)
14. **Auto-Procurement Tiers 2, 3, 4** (each behind its own Stratum milestone)

## 20. Open Questions For The Build Team

- Final Boon pool composition and trigger interval
- Whether Warden Subroutines have a passive effect when not in the active slot (currently: no)
- Whether Weekly Trial leaderboards should be local-only or use a static published top-1000 file (no backend, but pre-computed snapshots)
- Whether Stratum 18+ should introduce additional fleet archetypes or only steepen scaling
