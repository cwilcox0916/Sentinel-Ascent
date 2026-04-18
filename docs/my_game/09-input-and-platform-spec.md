# Input And Platform Spec

This document defines how `Sentinel Ascent` handles input on PC and tablet, the layout breakpoints across viewports, and the capability differences between Tauri and PWA builds.

`New` (no source-pack analog; the source genre is mobile-only and assumes a single touch model)

## 1. Supported Inputs

| Input | Supported on |
|---|---|
| **Mouse** (left, right, middle, scroll wheel) | PC desktop |
| **Keyboard** (full keyboard, configurable bindings) | PC desktop |
| **Gamepad** (Xbox / PlayStation / generic XInput, configurable bindings) | PC desktop |
| **Touch** (single + multi-touch) | Tablet (and laptops with touchscreens) |

All input is normalized through one bus (see [06-architecture-and-tech-stack.md](06-architecture-and-tech-stack.md) section 7).

## 2. Default Bindings

`New`

### PC mouse / keyboard

| Action | Binding |
|---|---|
| Buy upgrade | Left-click on row |
| Buy 10 of upgrade | Shift + Left-click |
| Buy max affordable | Ctrl + Left-click |
| Switch upgrade tab | Tab key, or click tab |
| Pause / open menu | Esc |
| Toggle Auto-Procurement on/off | A |
| Toggle game speed (1× → 2× → 3×) | Space |
| Equip Arsenal slot | 1–9 keys |
| Open Hangar (out of run) | H |
| Open Settings | comma `,` |
| Quick-save (forces auto-save now) | Ctrl + S |

### Gamepad (XInput nomenclature)

| Action | Binding |
|---|---|
| Move panel cursor | D-pad / left stick |
| Buy upgrade | A button |
| Buy 10 / max | A held |
| Switch upgrade tab | LB / RB |
| Pause | Start |
| Toggle Auto-Procurement | Y |
| Toggle game speed | RT |
| Activate Arsenal n (manual fire) | LT + face button |

### Tablet touch

| Action | Touch |
|---|---|
| Buy upgrade | Tap row |
| Buy 10 of upgrade | Long-press row (~400 ms) |
| Buy max affordable | Two-finger tap on row |
| Switch upgrade tab | Tap tab, or swipe horizontally on the panel |
| Pause | Tap top-right pause button |
| Toggle Auto-Procurement | Tap the Auto-Procurement chip |
| Toggle game speed | Tap the game-speed chip |
| Range circle reveal | Long-press anywhere on the Grid |
| Pinch | Reserved for future zoom; no-op at launch |

All bindings are remappable in Settings.

## 3. Touch Target Sizing

`Locked` (consistent with the prototype's component sizes)

- Minimum touch target: **44×44 CSS pixels** (Apple HIG / WCAG accessibility minimum)
- **Rail buttons** are 56×56 (PC) — comfortable for touch as-is
- **Arsenal slots** and **Protocol slots** in the bottom dock are 56×56 — already touch-sized (the dock is hidden on tablet anyway, but the same components reappear inside the docked-bottom panel sheet)
- **Forge upgrade rows** (`.up-row`) use 10 × 10 px padding on PC; on tablet, increase row min-height to **56 px**
- **HUD currency chips** (`.chip`) are 30 px tall; on tablet, increase to **40 px** so the values stay legible
- **Pills** (Pause / Close / Tweaks) are 30 px tall; on tablet, increase to **44 px**
- Confirmation dialogs use full-width buttons at **64 px** tall

Spacing follows the design system's 2 px-grid scale documented in [10-design-system.md](10-design-system.md) section 13.

## 4. Layout Breakpoints

`Locked` (matches the approved `Sentinel Ascent HUD.html` prototype — see [10-design-system.md](10-design-system.md) sections 4–5)

There are **two layouts**, not many. PC-first; tablet is a single fallback.

| Viewport | Layout |
|---|---|
| **≥1280 px** (PC desktop, tablet landscape) | Full shell grid: `72px rail · 1fr stage · 400px panel × 52px topbar · 1fr · 88px dock`. All four regions visible. |
| **<1280 px** (tablet portrait, small windows) | Reduced shell: `64px rail · 1fr stage × 48px topbar · 1fr · 280px panel`. **Bottom dock is hidden.** Right panel docks to the bottom as a 280 px sheet. |
| **≥1920 px** (ultrawide) | The shell still fills 100vw. The Stage gets the extra width. Top bar, rail, and right panel keep their fixed widths. No side letterboxing. |
| **<768 px** (phone) | Out of scope at launch. The build does not attempt to render below 1024 px wide; below 1280 the tablet fallback kicks in. |

Breakpoint switching uses CSS `@media (max-width: 1279px)` — no JS required, no layout reload.

The design pack ships only this single tablet fallback. Phone-class viewports are explicitly out of scope.

## 5. Mouse vs Touch Differences

`New`

| Behavior | Mouse | Touch |
|---|---|---|
| Hover tooltips | Yes (after 600 ms hover) | Replaced with long-press peek |
| Right-click context menu | Disabled in-game (browser default suppressed) | N/A |
| Drag selection | Used for Tier 4 rule editor reorder | Used for Tier 4 rule editor reorder |
| Range circle | Reveals on hover over the Sentinel; faintly visible otherwise | Only visible during long-press peek on the Grid |
| Edit affordances on Hangar loadout chips | `.edit` label fades in on chip hover (cyan) | Always visible |
| Cursor visibility | OS cursor visible | Hidden |

## 6. Gamepad Particulars

`New`

- Connection / disconnection events show a brief on-screen toast
- Vibration on Behemoth spawn, Resilience Surge, and Arsenal activation (player-toggleable)
- Cursor on screen when gamepad is in use; mouse hides until mouse is moved again

## 7. Tauri vs PWA Capabilities

`New`

| Capability | Tauri (desktop) | PWA (browser/tablet) |
|---|---|---|
| Save export | Native file dialog | `<a download>` link |
| Save import | Native file dialog | File input element |
| OS notifications (Daily Drop ready) | Yes (native) | Yes (Notification API, requires permission) |
| Offline play | Always | Yes (Service Worker) |
| Window controls (minimize/maximize/close) | Native | Browser chrome |
| Auto-update | Tauri updater (manual trigger) | Service Worker rolling update |
| File-system mirror backup | Yes (writes a backup `.sasave.json` to OS app data dir) | No (browser-sandboxed) |
| Steam achievements (if Steam release) | Possible via Tauri sidecar | No |

## 8. Platform Detection

`New`

```ts
export const platform = (() => {
  if (window.__TAURI__) return "tauri";
  const ua = navigator.userAgent;
  if (/iPad|Android.*Tablet|Tablet.*Android/.test(ua)) return "tablet-browser";
  if (matchMedia("(pointer: coarse)").matches) return "tablet-browser";
  return "browser";
})();
```

Platform-specific code paths live in `src/platform/`. Callers depend on small abstractions (e.g., `saveExport(slot)`) rather than branching on platform inline.

## 9. Accessibility

`New` (essential at launch)

- All text uses high-contrast palette by default
- Color-blind safe alternates for the Threat color language (Settings → Accessibility)
- Configurable HUD text size (S / M / L / XL)
- Reduced-motion mode (Settings → Accessibility) softens VFX, disables screen shake, slows currency popup motion
- Keyboard-only navigation across all menus on PC
- Gamepad navigation across all menus
- All interactive elements have ARIA labels for screen readers in browser mode
- A "Hold to Skip" duration setting for any timed dismissal

## 10. Resolution + Window Sizing

`New`

- Minimum window size on Tauri: 960 × 640
- Default window size on Tauri: 1280 × 800
- Tablet: full viewport, locked to the device's orientation lock setting
- Internal render resolution is the device pixel resolution; HUD font sizes use CSS pixels

## 11. Network Behavior

`New`

The game is single-player. Networked features are minimal and optional:

- **Weekly Trial seed file** — fetched from a static URL once per week, cached locally. If the fetch fails, the game uses the previously cached seed.
- **Achievement-pack updates** — optional pull from the same static host. Failures are silent.
- **No accounts, no logins, no telemetry without opt-in.**

In Tauri builds, the Tauri allowlist must include only the configured static fetch host(s); no broad network access.

## 12. Auto-Update

`New`

- **Tauri**: a "Check for updates" button in Settings triggers the Tauri updater with the player's confirmation. Auto-checking can be enabled but is off by default.
- **PWA**: standard Service Worker rolling update — the next launch picks up the new build. A small banner appears if a refresh is needed mid-session.

Migrations run on first load of the new build, automatically.

## 13. Power / Background Behavior

`New`

When the game is hidden (window minimized, browser tab unfocused, app backgrounded on tablet):

- Sim pauses immediately (the `requestAnimationFrame` loop is throttled by the browser anyway)
- A defensive auto-save fires
- Audio mutes
- On resume, time elapsed during background **does not** advance the sim — Sentinel Ascent is a session game, not an idle game (Research Bay and Order weekly objectives are the only systems that advance in real time, and they advance based on wall-clock timestamps, so they progress correctly with no sim ticks needed)

## 14. Testing Matrix

`New`

Pre-release testing must cover:

| Platform | Test runs |
|---|---|
| Windows + Tauri | Cold start, MVP run, save export → import |
| macOS + Tauri | Cold start, MVP run |
| Linux + Tauri | Cold start, MVP run |
| Chrome + PWA install | Cold start, offline run, save export → import |
| Safari iPad + PWA install | Cold start, touch input full coverage, offline run |
| Chrome Android tablet + PWA install | Cold start, touch input full coverage |
| Chrome desktop browser (no install) | Cold start, MVP run |

## 15. Open Questions For The Build Team

- Whether to support split-screen / windowed-side-by-side on tablet (recommend: no — too narrow)
- Whether to add Steam Deck-specific gamepad layout (recommend: yes if Steam release; the Deck's right trackpad as a cursor is useful)
- Whether to ship a "kid mode" with simpler HUD and no rules engine (recommend: deferred)
- Whether to support cross-device save sync via the player's own cloud folder (Dropbox/iCloud) — recommend: post-launch
