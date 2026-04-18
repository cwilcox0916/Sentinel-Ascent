# Beta Tester Guide

Thank you for joining the Sentinel Ascent closed alpha. This doc tells you how to install, what to try, and how to file a useful bug report.

## Builds

Two distribution channels:

- **PWA** — open the game URL in a desktop browser or Android Chrome / iOS Safari. Use "Install app" / "Add to Home Screen" to get a standalone window. Saves persist locally.
- **Desktop (Tauri)** — native installers per OS:
  - Windows: `Sentinel Ascent_0.1.0_x64_en-US.msi` or `Sentinel Ascent_0.1.0_x64-setup.exe`
  - macOS: `Sentinel Ascent_0.1.0_aarch64.dmg` (Apple Silicon) / `..._x64.dmg` (Intel)
  - Linux: `sentinel-ascent_0.1.0_amd64.deb` or `Sentinel Ascent_0.1.0_amd64.AppImage`

The desktop build has a Quit button in the Main Menu; the web build relies on the browser's close action.

## First-session checklist

1. Pick a save slot (Operator 1–5). Slots are fully isolated — each has its own progression.
2. Hit Launch from the Hangar to start your first run.
3. Spend Scrip in the Forge (right panel) during the run. Auto-Procurement is locked until you research Tier 1 in the Research Bay.
4. Survive until Cycle 10 to see your first Behemoth. Winning grants +1 Prism, Alloy, and unlocks the "Behemoth Slayer" achievement.
5. Back at the Hangar, visit **◆ Vault**: claim your Daily Drop (+30 Prisms), browse achievements, and check the Weekly Trial seed.
6. Visit **⚙ Settings**: turn on Reduced Motion if flashing bothers you; try a color-blind palette; opt into telemetry if you want to share crash reports.

## Progression gates (quick reference)

| System | Unlock gate |
|---|---|
| Research Bay | Stratum 1 / Cycle 150 |
| Auto-Procurement Tier 1 | Stratum 2 / Cycle 100 (Research Bay project) |
| The Order (weekly objectives) | Stratum 3 / Cycle 10 |
| Warden + Subroutines | Stratum 3 / Cycle 100 (+100 Subnodes) |
| Auto-Procurement Tier 2 | Stratum 4 / Cycle 50 |
| Auto-Procurement Tier 3 | Stratum 7 / Cycle 200 |
| Auto-Procurement Tier 4 | Stratum 12 / Cycle 100 |
| Fleet enemies (dev schedule) | Cycle 150 |
| Archive tech tree | Cycle 50 + Cipher Keys from Weekly Trials |

## What to test

- **5-slot save isolation** — create Operator 2, progress differently, Export Operator 1 to JSON, Delete it, Import it back. Everything should restore.
- **Mid-run snapshot resume** — close the tab mid-run. Reopen. Resume the slot. The sim should pick up exactly where you left off.
- **Auto-Procurement determinism** — same seed + same toggle history should reproduce the same buy sequence.
- **Boon choice pause** — the sim freezes while a Boon offer is pending. Confirm you don't bleed HP while deciding.
- **Settings side effects** — Reduced Motion, Low VFX, color-blind palette all apply immediately without a reload.
- **Weekly Trial seed** — the week's seed is identical across all players. Share your best Cycle + seed hash for a leaderboard.

## Known limitations (Phase 17 alpha)

- Fleet schedule is demo-accelerated (Cycle 150 instead of spec Cycle 15 000). Final balance pass will tighten.
- Audio engine not yet wired — volume sliders persist but don't play anything. Audio ships in a patch.
- Heirloom/Construct granting paths are limited; Phase 13's Order objectives aren't fully wired to earn them. Cheats available via `window.__sa` in dev builds.
- Augment rarity/affix roll system is a skeleton — Augments level up but don't yet roll stat affixes. A polish phase will expand.
- Tauri auto-updater is stubbed; manual download is required for new builds.

## Filing a bug report

1. Open **⚙ Settings → Telemetry**.
2. Opt into "Anonymous telemetry" (local-only — no data leaves your machine unless you send it).
3. Reproduce the bug.
4. Click **DOWNLOAD JSON** to save the session event log.
5. Click **Export** on your save slot to save the `.json` save (recommended; helps us reproduce).
6. Attach both files to the bug report along with:
   - OS + browser / Tauri build version
   - Steps to reproduce
   - Expected vs actual behavior

If the game crashes hard enough that you can't reach Settings, localStorage key `sentinel-ascent/telemetry` still holds the last ~500 events; recover it via DevTools → Application → Local Storage.

## Privacy

Everything stays on your device. There is no backend. No ads, no tracking pixels, no account required. Telemetry JSON contains only:

- An install-specific random correlation id (8 bytes of `crypto.getRandomValues`)
- Event timestamps and kinds (session-start, run-end, cycle-milestone, defeat, crash, …)
- Small data payloads per event (cycle numbers, kill counts, error messages truncated to 240 chars)
- User-agent string truncated to 120 chars

No personal data, no email, no IP. You control when and whether to share it.
