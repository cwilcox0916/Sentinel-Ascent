# Visual Style, UI, And Feedback

This document captures how `Sentinel Ascent` should look and feel on PC and tablet. It defers to [10-design-system.md](10-design-system.md) for exact tokens, component selectors, motion, and overlay layouts. This doc covers the *gameplay-facing* aspects of presentation: the simulation Grid, the world-space VFX language, readability, and audio.

## 1. Visual Identity

`Locked` (matches the approved `Sentinel Ascent HUD.html` prototype)

A clean, minimalist neon-cyber arcade style:

- Deep navy-black background with a faint hex/grid pattern
- Simple geometric shapes for all combatants (no detailed sprite art)
- Bright color-coded enemies and effects
- Circular Grid centered on the Sentinel
- Heavy reliance on outlines, glows, and pulses
- Readable first, decorative second

Theme cues:

- Sentinel core: bright cyan (`--cyan` / `#6ee7ff`) on a polygonal silhouette
- Enemy palette skews warm (red `--threat`, orange `--elite`, magenta `--fleet`)
- Control fields skew cool (`--control` `#4aa3ff`, `--cyan`)
- HUD chrome is thin lines + slight bloom — no skeuomorphic UI

The full palette and surface tokens are defined in [10-design-system.md](10-design-system.md) section 2.

## 2. Typography

Two fonts only — **Inter** for labels and body, **JetBrains Mono** for every number, timer, cost, and tabular value. Always with `font-variant-numeric: tabular-nums` so digits don't jitter as values tick. Full type scale in [10-design-system.md](10-design-system.md) section 3.

## 3. Sentinel Presentation

`Locked` (prototype reference)

The Sentinel sits at world `(0, 0)` and is visually iconic:

- Octagonal core body with a slowly rotating inner ring
- Surrounded by an optional Barrier ring and any active orbiting Sentries
- Emits cyan projectiles outward on every Attack Speed tick

Layered rendering of the Sentinel itself (back to front):

| Layer | Element |
|---|---|
| Outermost | Range circle (faint cyan, opacity gated by hover/touch-hold or Tweaks setting) |
| Outer | Barrier ring (thicker at full HP, thinner as it depletes) |
| Mid | Sentries orbiting at Sentry Speed |
| Core | Sentinel body + inner spinning ring |
| Effects | Active Arsenal overlays (Marker Beacon cones, Singularity halo, etc.) |

The Hangar overlay shows a separate **blueprint-style** Sentinel SVG with cyan callout boxes (Augment Nodes, Barrier Matrix, Core Reactor, Frame Integrity) and a slow vertical scanline. See [10-design-system.md](10-design-system.md) section 6.2.

## 4. Enemy Presentation

`Locked`

Enemies are simple shapes with strong silhouette roles:

| Archetype | Visual cue |
|---|---|
| Drone | Small bright diamond, threat-red |
| Skimmer | Slim arrow with a motion trail, threat-red |
| Hulk | Large chunky hexagon, thick outline, orange-tinted |
| Lancer | Triangle with a wind-up glow when firing |
| Behemoth | Oversized polygon with a thick outline; dedicated **Behemoth HP bar** at top-center of the Grid (see HUD spec) |
| Aegis | Standard body wrapped in a faint pulsing ring (the aura) |
| Leech | Body with a red beam channel during attack |
| Splitter | Fractured outline; flashes briefly before splitting |
| Lance | Body with a charging beam telegraph |
| Disruptor | Hot-pink fast silhouette (fleet palette) |
| Overseer | Slow purple body with a soft red empowerment aura |
| Resonant | Body trailing a glowing returning ring projectile |

Enemy color tokens (`--threat`, `--elite`, `--fleet`) are listed in [10-design-system.md](10-design-system.md) section 2.

The bottom-left **stage legend** displays a per-archetype color key during play.

## 5. Color Logic

`Locked`

Color is meaning. Full table in [10-design-system.md](10-design-system.md) section 9. Headlines:

| Effect | Color |
|---|---|
| Sentinel fire / friendly | `--cyan` |
| Health | green→cyan gradient |
| Barrier | cyan→blue gradient |
| Currencies | each currency's fixed token color (Scrip silver, Alloy gold, Prism green, Catalyst magenta, Insignia light blue, Cores orange, Cipher Keys brass) |
| Slow / control fields | `--control` |
| Damage amplification (Marker Beacon) | `--damage-amp` |
| DoT (Corrosive Bloom) | `--dot` |
| Singularity | `--singularity` |
| Resilience Surge trigger | bright white + cyan pulse |
| Auto-Procurement trigger | `--prism` |
| Save action | `--prism` |

## 6. HUD Layout (PC ≥1280 px)

`Locked` — exact grid, components, and breakpoints in [10-design-system.md](10-design-system.md) sections 4–5.

The shell is a CSS grid filling 100vw × 100vh: `72px rail | 1fr stage | 400px panel × 52px topbar | 1fr | 88px dock`.

- **Top bar (52 px)** — brand · 6 currency chips (Cycle, Scrip, Alloy, Prisms, Catalyst, Insignia) · runtime pill · 1×/2×/3× speed selector · pause pill · auto-save indicator
- **Left rail (72 px)** — `NAV` label + 6 primary rail buttons (Forge in-run / Research Bay / Protocols / Augments / Arsenals / Archive) + divider + 2 (Order / Weekly Trials)
- **Stage** — `<canvas>` with absolutely-positioned overlays (HP cluster top-left, Cycle badge top-right, Behemoth HP top-center, Behemoth alarm banner, Stage legend bottom-left, Kill feed bottom-right, Pause overlay)
- **Bottom dock (88 px)** — Protocols block · divider · Arsenals block (9 slots, 56 × 56 each) · divider · Cycle strip
- **Right panel (400 px)** — Forge tabs (Attack / Defense / Utility) + scrollable upgrade list + Auto-Procurement subpanel

## 7. HUD Layout (Tablet <1280 px)

Single fallback layout — top bar shrinks to 48 px, rail to 64 px, **bottom dock hides**, right panel docks to the bottom as a 280 px sheet. Same tokens, same component visuals. See [10-design-system.md](10-design-system.md) section 5.

## 8. Animation Language

Five primary motion types on the Grid:

- **Radial inward** — enemy movement toward the Sentinel
- **Rotational** — Sentries, Marker Beacon cones, Annihilator Beam sweep
- **Expanding circles** — Pulse, Annihilation Pulse
- **Beam sweeps** — Annihilator Beam, Lance attacks, Leech drain
- **Quick streaks** — Sentinel projectiles, Seeker Salvo missiles, Arc Cascade arcs

UI-side motion (rail pulses, alarm flashes, auto-buy feedback, toast fades, launch overlay, defeat fade) is fully enumerated in [10-design-system.md](10-design-system.md) section 8.

## 9. VFX Behaviors To Preserve

- Hit flashes on enemies and Sentinel
- Currency popups in the matching currency's color, slight upward drift + fade
- Radial Pulses on every shockwave
- Beam glows scaled by damage
- Arc Cascade jagged arcs between targets
- Singularity suction trails for affected enemies
- Marker Beacon cone rotation
- Annihilator Beam sweep with bright trail
- Behemoth alarm box-shadow loop while a Behemoth is on the Grid

## 10. Readability Rules

- Enemy outlines must remain visible under overlapping effects (use additive outline pass)
- Hazards (Lance beams, Leech drain, Resonant projectile, Behemoth alarm) need stronger contrast than farming effects
- Persistent AoEs (Stasis Field, Corrosive Bloom, Marker Beacon) must be semi-transparent
- Behemoth, Elite, and Fleet units must be identifiable instantly by silhouette alone
- Damage numbers stack vertically when the same target is hit repeatedly; do not let them clutter the stage
- The bottom dock is dense; reserve hover/tooltip detail for cooldown specifics

## 11. HUD Feedback Specifics

| Event | Feedback |
|---|---|
| Auto-save fires | `.save-ind` pulses prism for ~400 ms |
| Auto-Procurement buys an upgrade | The relevant `.tab` pulses its `.auto-glow` dot; the bought `.up-row` plays the `autobuy` keyframe; a small green toast appears in the toast stack |
| Behemoth incoming | `.behemoth-banner` displays `⚠ BEHEMOTH INCOMING — PROTOCOLS LOCKED`; `.behemoth-hp` becomes visible at top-center |
| Resilience Surge triggers | Brief full-stage white flash + cyan radial pulse from Sentinel |
| Cycle completion | `.chip.cycle` value increments; `.cycle-strip` advances; soft chime |
| Arsenal ready | Slot border switches from default to `--cyan-dim` with cyan inset glow |
| Insufficient Scrip | Cost text on `.up-row` turns `--threat` color; row drops to 0.55 opacity |
| Pause | `.pause-overlay` shows over the stage with blur backdrop and "PAUSED" cyan headline |

## 12. Performance Recommendations

Late-game combat is effect-dense. Required practices:

- **Object-pool** projectiles, popups, and short-lived VFX
- Use **batched** `Graphics`/`Sprite` rendering through a single shared geometry where possible
- Cap simultaneous particles (suggested 1000 ceiling; cull oldest first)
- Provide a **Low VFX mode** toggle in settings (disables non-critical particles, dims persistent fields)
- **Decouple** simulation (60 Hz fixed) from render (display refresh) — see [06-architecture-and-tech-stack.md](06-architecture-and-tech-stack.md) section 4
- Targets: 60 fps on a 2020-era tablet at Cycle 1000; 144 fps on desktop at Cycle 5000

The DOM-based HUD itself is cheap (the React tree is small and updates from the UI store at ~10 Hz, not every sim tick).

## 13. Audio Cues

Tight, electronic palette:

- Per-Cycle progression chime
- Behemoth-spawn alarm
- Fleet-spawn alarm (distinct, two-tone)
- Each Arsenal has a unique fire sound
- Resilience Surge triggers a strong short whoosh
- Auto-Procurement purchases make a soft, low-volume click
- Currency pickups have pitch-shifted variants so rapid pickups don't overlap as a single tone
- Save indicator flash has no sound (visual only)

All sounds played through Howler.js with per-channel volume sliders in settings.

## 14. Presentation Quality Bar

The clone is visually faithful when:

- At a glance, anyone sees "central defender surviving a radial swarm"
- Sentries, beams, Charges, and fields are readable without labels
- Higher complexity looks intense but not messy
- Currency popups are immediately identifiable by color
- The Auto-Procurement pulse is noticeable but never visually disruptive
- The HUD looks identical at 1280, 1440, 1920, and 2560 px wide on PC
- The tablet single-fallback layout is comfortable in landscape and portrait

## 15. Open Questions For The Build Team

- Whether Behemoth HP bars should scroll to the side of the Grid in tablet portrait (current spec: stay top-center, narrower)
- Whether to dim the upgrade panel during Behemoth fights to focus attention (current spec: no — Auto-Procurement still operates)
- Final color-blind palette swap targets — already scoped to threat/elite/fleet/prism in [10-design-system.md](10-design-system.md), but designer needs to specify the swapped colors
