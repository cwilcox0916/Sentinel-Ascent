# Design System

This document is the single source of truth for `Sentinel Ascent`'s visual design — color tokens, typography, spacing, layout grids, component patterns, and motion. Every other doc in this pack defers to this one for visual specifics.

`New` (locked from the approved `Sentinel Ascent HUD.html` design prototype)

## 1. Status

The design is **PC-first, full-viewport, ≥1280 px optimized**, with a single tablet fallback layout below 1280 px. The visual identity, layout grids, and component patterns described here are **locked** — implementations must match.

The reference prototype `Sentinel Ascent HUD.html` covers the in-run HUD plus three full-viewport overlay screens: Research Bay, Hangar, and Defeat. These four screens are the launch UI surface. Other systems described in [04-progression-systems.md](04-progression-systems.md) (Protocols editor, Augments tree, Archive tech tree, Order seasonal tracker) follow the same tokens and patterns.

## 2. Design Tokens

### Surface

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#07090f` | Page background, deepest layer |
| `--bg-1` | `#0b0f18` | Cards, secondary surfaces |
| `--bg-2` | `#101624` | Inset cells, chip backgrounds |
| `--bg-3` | `#16203288` | Translucent chip surface (over canvas) |
| `--panel` | `#0c1220cc` | Translucent panel over canvas |
| `--panel-solid` | `#0c1220` | Solid panel (settings, modals) |

### Lines

| Token | Value | Use |
|---|---|---|
| `--line` | `#1a2436` | Default border |
| `--line-bright` | `#243049` | Active/hover border |
| `--line-hot` | `#2d3b58` | Strong hover, dashed elements |

### Text

| Token | Value | Use |
|---|---|---|
| `--fg` | `#d8e3f5` | Primary text |
| `--fg-dim` | `#8fa0bf` | Secondary text |
| `--fg-mute` | `#5a6a86` | Labels, metadata |
| `--fg-faint` | `#3d4a64` | Disabled, captions |

### Identity

| Token | Value | Use |
|---|---|---|
| `--cyan` | `#6ee7ff` | Sentinel/friendly fire, primary accent |
| `--cyan-dim` | `#2fb9d6` | Active borders, gradient stops |
| `--cyan-glow` | `#6ee7ff55` | Inner shadows, glows |

### Currencies (every currency has a fixed color — never reuse for non-currency UI)

| Currency | Token | Value |
|---|---|---|
| Scrip | `--scrip` | `#b6c3db` (silver) |
| Alloy | `--alloy` | `#f3c34a` (warm gold) |
| Prisms | `--prism` | `#6ee79d` (bright green) |
| Catalyst | `--catalyst` | `#e96bd6` (magenta) |
| Insignia | `--insignia` | `#7bb8ff` (light blue) |
| Cores | `--core` | `#ff8a5c` (orange) |
| Cipher Keys | (literal) | `#c6b37a` (brass) |

### Threat (enemy / hostile)

| Token | Value | Use |
|---|---|---|
| `--threat` | `#ff5a6e` | Default hostile, Drone, danger states |
| `--threat-hot` | `#ff2f79` | Behemoth alarm, critical states |
| `--elite` | `#ff8c42` | Elite enemy palette |
| `--fleet` | `#ff3dc2` | Fleet enemy palette |

### Effects

| Token | Value | Use |
|---|---|---|
| `--damage-amp` | `#f3a54a` | Marker Beacon vulnerability tint |
| `--dot` | `#77e27b` | Corrosive Bloom |
| `--singularity` | `#8e5fe6` | Singularity field |
| `--control` | `#4aa3ff` | Stasis Field, slow effects |

### Radii

| Token | Value |
|---|---|
| `--radius` | `6px` (default) |
| `--radius-lg` | `10px` (modals, hero cards) |

## 3. Typography

Two fonts, no third.

| Font | Weights | Use |
|---|---|---|
| **Inter** | 400, 500, 600, 700 | All UI labels, headings, body text |
| **JetBrains Mono** | 400, 500, 600, 700 | All numbers, timers, costs, tabular data, code-style metadata. Always with `font-variant-numeric: tabular-nums`. |

Type scale (CSS pixels, body anchor `13px`):

| Use | Size | Weight | Letter-spacing | Transform |
|---|---|---|---|---|
| Body / row text | 13 / 12 | 400/500 | normal | none |
| Section headers | 14 | 600 | 0.22em | uppercase |
| Panel titles | 12 | 600 | 0.22em | uppercase |
| Tab labels | 11 | 500 | 0.14em | uppercase |
| Chip labels | 9 | 400 | 0.18–0.22em | uppercase |
| Microcaptions | 8 | 400 | 0.22–0.32em | uppercase |
| Chip values (numbers) | 14 | 600 | normal (mono) | none |
| HUD numbers (cycle, HP) | 18–22 | 600 | normal (mono) | none |
| Hero numbers (defeat cycle) | 96 | 200 | -0.06em (mono) | none |
| Defeat headline | 72 / 84 | 200 / 600 | 0.04 / 0.12em | none |

A class `.mono` applies JetBrains Mono with tabular-nums.

## 4. Layout — PC (≥1280 px)

The shell is a CSS grid filling 100vw × 100vh:

```
grid-template-columns: 72px  1fr  400px;
grid-template-rows:    52px  1fr  88px;
grid-template-areas:
  "top   top    top"
  "rail  stage  panel"
  "rail  dock   panel";
```

### Top bar (52 px)

Left to right:

1. **Brand** — 22 px hex logo (cyan stroke + filled core) + game wordmark + sub-tag (e.g. `STRATUM 07 · TRIAL RUN`); right-bordered separator
2. **Currency chip row** — 6 chips: Cycle, Scrip, Alloy, Prisms, Catalyst, Insignia
   - Each chip: `--bg-3` background, `--line` border, 6 px radius, 30 px min height, 6 × 10 px padding
   - Chip label: 9 px uppercase muted; value: 14 px mono in the currency's color; optional delta (e.g. `+842/cyc`) in 10 px mono muted
   - The Cycle chip carries a 2 px left border in `--cyan`
3. **Spacer** (flex 1)
4. **Runtime pill** (`HH:MM:SS`, mono)
5. **Speed selector** — segmented `1× / 2× / 3×` buttons; active = `--cyan` background with `#061018` text
6. **Pause pill** (`⏸  Pause · Esc`)
7. **Save indicator** (22 × 22) — flashes prism-green on every auto-save

### Left rail (72 px)

Vertical column. Top label `NAV` (8 px letter-spaced muted), then 56 × 56 rail buttons with 8 px radius and stacked SVG glyphs:

| Rail button | Glyph hint |
|---|---|
| Forge (in-run) | nested hex |
| Research Bay | concentric circles + cardinal ticks |
| Protocols | two stacked rectangles |
| Augments | hex with diagonals |
| Arsenals | clock-face with hand |
| Archive | central node + 4 corner satellites |
| *(divider)* | |
| Order | star |
| Weekly Trials | calendar |

States:

- Default — `--bg-2`, `--line`, muted text
- Hover — `--line-hot`, `--fg`
- Active — `--cyan-dim` border, `--cyan` text, `#0f1a2a` background
- Complete-pulse — green pulse animation + small green dot top-right indicator (used when something off-screen completes, e.g., a research project)

### Stage (center)

A `<canvas id="grid-canvas">` filling the area, with absolutely-positioned overlays drawn at z-index 3:

| Overlay | Position |
|---|---|
| **HP cluster** (Health bar + Barrier bar) | top-left, 14 px inset, ≥260 px wide |
| **Cycle badge** (Stratum / Cycle / Next Behemoth) | top-right, 14 px inset; flex row of 3 metrics |
| **Behemoth HP bar** | top-center, 420 px wide, threat palette, only visible during a Behemoth fight |
| **Behemoth alarm banner** | top-center, 70 px from top, animated alarm box-shadow, only visible when imminent |
| **Stage legend** | bottom-left, 14 px inset; tiny color-dot key for enemy types |
| **Kill feed** | bottom-right, 14 px inset, 200 px wide, column-reverse stack with fade-in |
| **Pause overlay** | full-stage, `radial-gradient` with `backdrop-filter: blur(4px)`, big "PAUSED" headline in cyan |

The stage background uses a faint hex grid via `linear-gradient` at `48px × 48px`, masked by a radial fade so edges go dark.

### Bottom dock (88 px)

Three blocks separated by 1 px vertical dividers:

1. **Protocols** — header label + row of equipped Protocol slots (56 × 56, dashed border when empty, solid when equipped, `LOCKED` overlay when slot not unlocked)
2. **Arsenals · Auto-fire on cooldown** — header label + row of 9 Arsenal slots:
   - 56 × 56, 8 px radius, radial-gradient inner fill
   - Ready state: `--cyan-dim` border + inset cyan glow + cyan glyph
   - Cooldown overlay (`.cd-fill`): translucent dark fill anchored to bottom, scales `transform-origin: bottom`
   - Top-right kbd hint (8 px mono); bottom-center label (8 px letter-spaced)
   - Disabled state: 0.35 opacity
3. **Cycle strip** (≥180 px) — header label + a 14 px tall row of tick segments (one per upcoming Cycle), with current marked in cyan + glow and Behemoth Cycles in threat color; meta row underneath: `from … behemoth @ N … to`

### Right panel (400 px)

| Section | Detail |
|---|---|
| **Panel head** | Title `Forge · In-Run` + sub `Spend Scrip · upgrades reset on run end`; below: 3 tabs `Attack / Defense / Utility` with 2 px cyan underline on active. Each tab also carries an `.auto-glow` dot top-right that pulses prism-green when Auto-Procurement is active in that category. |
| **Upgrade list** (scrollable) | One `.up-row` per stat: 2-col grid, name + small level pill on left row 1, current → next stat preview in mono on row 2, cost stack on right (mono, scrip color; turns threat color when unaffordable). On auto-buy: row plays a `autobuy` keyframe pulse in prism. Auto-targeted stats carry a small prism `auto-pin` top-right. |
| **Auto-Procurement subpanel** | Bottom of panel, separated by top border. Header: title + tier badge (mono prism) + master toggle (prism on). Three channel cards `Attack / Defense / Utility` in a 3-col grid; active channel border becomes prism. Foot row: rules count `RULES · 0/5` and current research timer `TIER 3 · RESEARCHING 14:22:08`. |

## 5. Layout — Tablet (<1280 px)

Single fallback layout, not multiple breakpoints:

```
grid-template-columns: 64px  1fr;
grid-template-rows:    48px  1fr  280px;
grid-template-areas:
  "top   top"
  "rail  stage"
  "panel panel";
```

- Top bar shrinks to 48 px
- Rail shrinks to 64 px
- Bottom dock is hidden (`.bottom-dock { display: none }`); Arsenals are reachable via a rail button or in-stage overlay (TBD in the build)
- Right panel docks to the bottom as a full-width 280 px sheet
- Same tokens, same component visuals

> The original design pack ships only this single tablet fallback. Smaller (phone) viewports are out of scope at launch.

## 6. Overlay Screens

Three full-viewport overlays sit at z-index 30. Each has `display: none` by default and `.open` enables `display: flex`. While any `.screen.open` is mounted, in-stage toasts auto-hide via `body:has(.screen.open) .toasts { display: none }`.

### 6.1 Research Bay

Layout:

```
Header (52 px)
Body grid: 240px nav | 1fr main | 380px detail
```

Header: breadcrumb `Hangar ▸ Research Bay`, mini chip row (Alloy / Catalyst / Prisms / Cipher), close pill.

Left nav: project lines list (Auto-Procurement, Project Acceleration, Overclock, Combat Doctrine, Economy, Defense Systems, Fleet Countermeasures, Archive Interface). Each row: name + count pill. The active row gets `--line-hot` border + `--fg` text. The "hot" modifier (Auto-Procurement) gets a cyan-dim count pill.

Main column:

- **Research Slots track** — 5 slot cells in a flex row. States: `busy` (with active project name + countdown timer + cyan progress bar), `empty` (`Slot 03 · Idle`), `locked` (dashed outline with Prism cost to unlock).
- **Auto-Procurement Tier Ladder** — 4 tier cards in a 4-col grid. Each card: large 32 px tier number (mono, ultra-light), tier name (`PROCUREMENT II — MULTI-CHANNEL`), description, status row with state badge.
  - Owned: green border + green badge
  - Researching: amber border + amber badge + bottom progress bar
  - Locked: faded + red badge
  - Queued: indigo border + indigo badge
  - Active (selected): cyan-dim border with cyan inset glow
  - Complete-flash: a 1.2 s prism inset+outset glow keyframe on completion
- **Project rows** — 2-col grid of generic project rows (name + description + tag chips on left, cost cell + duration on right)
- **Project Acceleration gauge** — single horizontal row: `L23 / 99` + a fill gauge + `+46% speed` mono cyan + next-cost `Next · +2% for 820K Alloy`

Right detail panel:

- Title + subtitle
- Body: capability bullets (`<h4>` micro-headings + `<p>` and `<ul>`) + `.rd-kv` definition list for cost/duration/gate metadata
- Foot: `.rd-cost` row showing required currencies (each one turns threat color if unaffordable) + a primary `.rd-action` button. Button states: default (cyan gradient), `disabled` (gray), `researching` (amber), `owned` (prism)
- For Tier 4 specifically: a `.rd-rules` list of rule chips with toggle switches (each chip: rule name + sample condition in mono + toggle)

### 6.2 Hangar

Layout:

```
Header (52 px) — breadcrumb HANGAR + sub-nav (LOADOUT / STRATUM / ARCHIVE / SEASON) + chip-mini row + close
Body grid: 260px sentinel-list | 1fr hero | 360px right-col
       row 1: full-width modifier banner
       row 2: list | hero (with stats + loadout + heirlooms strip) | right-col (stratum + last run + launch)
```

- **Modifier banner** spans all columns. Three segments: `DAILY MUTATOR` (amber tag), `WEEKLY TRIAL` (indigo tag), `Season rotates in HH:MM:SS` (right-aligned cyan countdown).
- **Sentinel list** (left) — vertical list of available Sentinels. Each row: 36 × 36 crest icon, name + class line, level pill. Active row: cyan-dim border + cyan-glow inset. Locked row: 0.4 opacity. Below the list: a Mastery section with progress bar.
- **Hero card** (center) — large title (e.g. `VIGIL-07`) + subtitle, top-right meta items (Mastery, Best Cycle, Clears).
  - **Hero stage** — blueprint-style SVG of the Sentinel on a faint blue grid background, with 4 cyan callout boxes (Augment Nodes 6/8, Barrier Matrix T5, Core Reactor 240%, Frame Integrity 98%) and a slow vertical scanline animation
  - **Hero stats strip** — 5-cell horizontal grid, each cell: micro key + mono value + delta (prism for positive, threat for negative)
  - **Loadout chips row** — 4 chips: Protocols, Augments, Arsenal, Auto-Procurement; each chip shows headline name + sub-detail; reveals an `EDIT` cyan affordance on hover
- **Heirloom strip** — full-width row inside the center column area: label "HEIRLOOMS" + 6 heirloom cells + "Browse all 34" link
- **Right column**:
  - **Stratum ladder** — vertical scrolling list of Strata 1–N. Each row: large mono number, name, flavor sub-line, recommendation badge (e.g. `current` in cyan, `BEST 214` in mute mono). Active stratum: cyan-dim border + cyan glow.
  - **Hangar launch card** — sits inside the stratum container at bottom, shows current stratum + mods reminder, then a big `▶ LAUNCH RUN` button (cyan gradient, 0.28em letter-spacing, sweep-shimmer on hover)
  - **Last Run card** — header `LAST RUN · 4H AGO` + status badge in threat color; 2 × 2 metric grid (Cycles reached, Alloy, Prisms, Time); cause-of-death line at bottom with the killing enemy name in threat color

**Launch overlay** — full-viewport, fired by clicking Launch. Radial dark gradient + tiny `LAUNCH SEQUENCE` tag + huge mono numeral countdown (180 px, light weight, cyan glow shadow, `lcPulse` 1 s scale animation) + Sentinel name underneath + 2 expanding cyan rings (`lcRing` 2 s).

### 6.3 Defeat

Layout:

```
Full-viewport dark overlay with red wash and scanline grain
Top-right: close pill
Body: 45% / 55% grid
```

- **Left side** (dramatic):
  - Top-left rectangular `▲ STAMP` in red-bordered mono
  - **Headline**: `SENTINEL` (72 px, light) + `DOWN` (84 px, weight 600, threat color, `0.12em` letter-spacing); shadow with threat-tinted glow
  - Sub-headline mono: `RUN TERMINATED · CYCLE 189` with the cycle highlighted threat
  - **Cycle big** block: `CYCLE` label + 96 px mono cycle number + PB delta (`PB 214 · −25`)
  - Behind the headline: a faint fractured Sentinel SVG (the same blueprint, fragmented and rotated, at 0.16 opacity)
  - **Cause card** at bottom: red-tinted bordered card with an enemy icon, enemy name, and explanatory line (e.g. `Behemoth-Weaver · 4 spawned protectors at 188 — Sentinel surrounded`)
- **Right side** (analytical, scrollable):
  - **Run Statistics** section: 6-cell stat grid (Cycles, Runtime, Peak DPS, Barrier Held, Scrip, Kills) with PB delta below each value (prism for up, threat for down)
  - **Frame Integrity sparkline** (80 px tall) — HP-over-time SVG line + vertical event markers (`ev`, with `data-ev` text label) + a `death` marker in threat
  - **Key Events timeline** — list of event rows: timestamp (mono mute) + dot (good = prism, bad = threat, event = cyan) + message
  - **Run Yield** — 4 reward cards in a row (Alloy / Catalyst / Prisms / Cipher), each with a 3 px left color stripe and a counter that rolls up from 0 on open
  - **Heirloom drop callout** — green-bordered horizontal card with icon + tag `HEIRLOOM ACQUIRED` + name + rarity
  - **CTA row** — 3 buttons: `RETRY · SAME LOADOUT` (cyan gradient primary), `ADJUST IN HANGAR` (neutral), `DISMISS` (transparent ghost)

## 7. Components Inventory

| Component | Selector | Purpose |
|---|---|---|
| `.chip` | top-bar currency chips | Currency / metric chip with label + value + optional delta |
| `.chip-mini` | overlay screen header chips | Compact chip used in screen heads |
| `.pill` | various | Inline button-pill (Pause, Close, Tweaks, Runtime) |
| `.speed-group` | top bar | Segmented 1×/2×/3× speed selector |
| `.save-ind` | top bar right | Auto-save indicator with prism flash |
| `.rail-btn` | left rail | 56×56 nav button with active/complete-pulse states |
| `.hp-row` | stage overlay | HP / Barrier bar with label + bar + numeric readout |
| `.cycle-badge` | stage overlay | Top-right cycle/stratum/next-behemoth panel |
| `.behemoth-banner` / `.behemoth-hp` | stage overlay | Behemoth alarm + HP bar |
| `.kill-feed` / `.kf-line` | stage overlay | Bottom-right kill feed |
| `.stage-legend` | stage overlay | Bottom-left enemy color key |
| `.pause-overlay` | stage overlay | Pause modal over the stage |
| `.arsenal-slot` | bottom dock | 56×56 Arsenal slot with cooldown overlay |
| `.protocol-slot` | bottom dock | 56×56 Protocol slot, dashed when empty |
| `.cycle-strip` | bottom dock | Tick-bar of upcoming Cycles |
| `.tab` / `.tab.active` | right panel head | Forge category tabs with auto-glow indicator |
| `.up-row` | right panel | Forge upgrade row with name/lvl/stat-line/cost |
| `.ap-panel` / `.ap-channels` / `.ap-chan` / `.ap-toggle` | right panel | Auto-Procurement subpanel and channel cards |
| `.toasts` / `.toast` | floating | Bottom-right toast stack (auto, kill variants) |
| `.tweaks-panel` | floating | Dev/debug tweaks panel (not in launch UI) |
| `.screen` / `.screen-head` / `.screen-body` | overlays | Generic full-viewport overlay shell |
| `.research-nav` / `.rn-item` | Research Bay | Project-line nav |
| `.slot-track` / `.slot-cell` | Research Bay | Active research slot cells |
| `.tier-ladder` / `.tier-card` | Research Bay | The 4 Auto-Procurement tier cards |
| `.project-grid` / `.project-row` | Research Bay | Generic project rows |
| `.overclock-line` | Research Bay | Project Acceleration gauge |
| `.research-detail` / `.rd-*` | Research Bay | Right detail pane (head/body/foot/cost/action/rules) |
| `.rule-chip` | Research Bay Tier 4 | Adaptive rule toggle chip |
| `.hg-banner` / `.bseg` | Hangar | Modifier banner (Daily / Weekly / Countdown) |
| `.hg-sentinels` / `.sentinel-row` / `.sentinel-crest` | Hangar | Sentinel list |
| `.hg-hero` / `.hg-hero-stage` / `.callout` / `.scanline` | Hangar | Center hero with blueprint and callouts |
| `.hg-hero-stats` / `.hg-stat-cell` | Hangar | 5-cell stat strip |
| `.hg-loadout` / `.lo-slot` | Hangar | Loadout chip row |
| `.hg-stratum` / `.stratum-row` / `.stratum-ladder` | Hangar | Stratum ladder |
| `.hg-last-run` | Hangar | Compact last-run summary |
| `.hg-launch` / `.launch-btn` | Hangar | Stratum reminder + Launch button |
| `.hg-heirlooms` / `.heirloom-cell` | Hangar | Heirloom strip |
| `.launch-overlay` / `.lc-num` / `.lc-ring` | Launch | Countdown overlay |
| `.defeat-overlay` / `.df-*` | Defeat | Headline / cause / stats / sparkline / timeline / rewards / heirloom-drop / CTAs |

## 8. Motion Inventory

All motion lives in keyframes named below. Reduced-motion mode disables every keyframe except `fadein` (which becomes a 0 ms transition).

| Keyframe | Duration | Easing | Use |
|---|---|---|---|
| `railPulse` | 1.4 s | ease-in-out | Rail-button complete pulse (loops) |
| `alarm` | 1.2 s | ease-in-out | Behemoth banner alarm (loops) |
| `fadein` | 0.3 s | default | Kill-feed line entry |
| `autopulse` | 1.4 s | default | Tab auto-glow dot (loops while active) |
| `autobuy` | 0.6 s | ease-out | Upgrade-row auto-buy flash (one-shot) |
| `toastin` | 0.25 s | ease-out | Toast entry |
| `toastout` | 0.3 s | ease-in (delay 2.5 s) | Toast exit |
| `scanlineMove` | 4.5 s | linear | Hangar hero scanline (loops) |
| `launchFade` | 0.4 s | ease-out | Launch overlay enter |
| `lcPulse` | 1 s | ease-in-out | Launch countdown number scale (loops) |
| `lcRing` | 2 s | ease-out | Launch overlay expanding rings (loops) |
| `defeatFade` | 0.6 s | ease-out | Defeat overlay enter (scale + fade) |
| `tierComplete` | 1.2 s | ease-out | Research tier completion glow (one-shot) |
| `counterFlash` | 1.5 s | ease-out | Defeat reward counter on roll-up |

## 9. Color Logic (Gameplay Language)

Color is meaning. Don't reuse colors across categories.

| Meaning | Color |
|---|---|
| Sentinel / friendly fire | `--cyan` |
| Health bar | green→cyan gradient |
| Barrier bar | cyan→blue gradient |
| Damage to Sentinel | `--threat` flash |
| Hostile (default) | `--threat` |
| Elite | `--elite` |
| Fleet | `--fleet` |
| Behemoth alarm | `--threat-hot` |
| Slow / control field | `--control` (and `--cyan` for Stasis specifically) |
| Damage amplification (Marker Beacon) | `--damage-amp` |
| DoT (Corrosive Bloom) | `--dot` |
| Singularity field | `--singularity` |
| Auto-Procurement trigger | `--prism` |
| Save action | `--prism` |
| Currency popups | each currency's token color |

## 10. Iconography

All icons are inline SVG, single-stroke, 1.6 px stroke weight by default, `currentColor` stroke (so they tint with surrounding text color). No raster icons. Library style is **geometric line-art** — circles, hex/octagons, ticks, no rounded warmth.

Sentinel logo: nested hex polygon (8 vertices) with a filled 1.8 r cyan core circle, optional `drop-shadow(0 0 6px var(--cyan-glow))`.

## 11. Background Treatments

- **Stage** background: a faint hex/grid pattern at 48 px tile, masked with a radial fade so edges go dark. Pattern uses `--line` at 12% opacity.
- **Hangar hero stage**: a 24 px tile blueprint grid using a 0.08 alpha cyan tint, plus a soft cyan radial spotlight in the center.
- **Defeat overlay**: layered radial gradients — red tint at 30% / 45%, deep navy at 75% / 55%, plus a subtle 1 px scanline grain via `repeating-linear-gradient` blended with `mix-blend-mode: overlay`.

## 12. Scrollbars

Custom scrollbars only inside scrollable panels (`.upgrade-list`, `.research-main`, `.df-right`):

- Track: transparent
- Thumb: `--line`, 4 px radius
- Width: 8–10 px

## 13. Spacing Scale

The design pack does not declare a strict 4 / 8 px spacing scale, but every value used falls on a 2 px grid. Recommended canonical scale for new components:

`2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 28 · 40 · 60 · 80`

## 14. Implementation Notes

- The reference HTML uses CSS custom properties for every token. Implementations should preserve token names exactly; use `:root { --cyan: #6ee7ff; }` etc.
- All numbers in the HUD (currencies, costs, timers, stats) use the `.mono` class (JetBrains Mono with `tabular-nums`). This is non-negotiable — proportional digits cause jitter as values tick.
- The `body:has(.screen.open) .toasts { display: none }` rule is the canonical pattern for "hide in-stage chrome while an overlay is open." Reuse it for any future overlays.
- Reduced-motion mode (Settings → Accessibility) replaces all keyframes with their final state and disables hover sweeps (the launch button shimmer, etc.).
- Color-blind alternate palettes swap **only** the threat / elite / fleet tokens, plus the auto-buy `--prism`. The base cyan and currency colors stay (they are paired with text labels everywhere).

## 15. Cross-References

- HUD layout details consumed by [03-visual-style-ui-and-feedback.md](03-visual-style-ui-and-feedback.md)
- Layout breakpoints and input mapping in [09-input-and-platform-spec.md](09-input-and-platform-spec.md)
- PixiJS scene-graph layers map onto canvas; DOM HUD components in this doc sit above (see [06-architecture-and-tech-stack.md](06-architecture-and-tech-stack.md) sections 3 and 6)

## 16. Open Questions For The Build Team

- Final designer-supplied color-blind palette (this doc only specifies which tokens swap)
- Whether to ship Tweaks panel (`.tweaks-panel`) in production builds gated behind a key combo, or strip from production entirely
- Final Sentinel blueprint set per Sentinel class (the prototype shows one; Hangar implies six classes including two classified)
- Whether Hangar sub-nav (LOADOUT / STRATUM / ARCHIVE / SEASON) routes to four screens or four sub-views inside Hangar
