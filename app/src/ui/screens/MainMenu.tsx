/**
 * Main Menu — boot entry point.
 *
 * Play / Settings / About / Quit.
 *
 * Play    → slot picker (route "title")
 * Settings → opens the last-used slot's settings, or disabled if no slot exists
 * About   → in-place modal with version + credits
 * Quit    → Tauri window close on desktop; hidden on web (browsers block tab close)
 */

import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore.ts";
import { getLastUsedSlot, loadSlot } from "../../save/repository.ts";
import { SettingsHost, applySettingsSideEffects } from "./Settings.tsx";
import { quitApplication, isTauri } from "../../platform/quit.ts";

export function MainMenu() {
  const setRoute = useAppStore((s) => s.setRoute);
  const setActiveSlot = useAppStore((s) => s.setActiveSlot);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastSlotReady, setLastSlotReady] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const id = await getLastUsedSlot();
      setLastSlotReady(id != null);
    })();
  }, []);

  const onPlay = (): void => setRoute("title");

  const onSettings = async (): Promise<void> => {
    const id = await getLastUsedSlot();
    if (id == null) return;
    const slot = await loadSlot(id);
    if (!slot) return;
    applySettingsSideEffects(slot.settings);
    setActiveSlot(slot);
    setSettingsOpen(true);
  };

  return (
    <div className="main-menu">
      <div className="mm-backdrop" aria-hidden />
      <div className="mm-center">
        <div className="mm-brand">
          <img className="mm-logo" src="/icon-512.png" alt="Sentinel Ascent" />
          <div className="mm-tag mono">RADIAL SURVIVAL-DEFENSE INCREMENTAL</div>
        </div>

        <div className="mm-buttons">
          <button className="mm-btn primary" onClick={onPlay}>
            <span className="mm-btn-label">Play</span>
            <span className="mm-btn-hint mono">
              {lastSlotReady ? "CONTINUE · SELECT OPERATOR" : "PICK A PROFILE"}
            </span>
          </button>
          <button
            className="mm-btn"
            onClick={onSettings}
            disabled={!lastSlotReady}
            title={lastSlotReady ? "Configure the last-used profile" : "Create a profile first"}
          >
            <span className="mm-btn-label">Settings</span>
            <span className="mm-btn-hint mono">ACCESSIBILITY · AUDIO · INPUT</span>
          </button>
          <button className="mm-btn" onClick={() => setAboutOpen(true)}>
            <span className="mm-btn-label">About</span>
            <span className="mm-btn-hint mono">VERSION · CREDITS</span>
          </button>
          {isTauri() && (
            <button className="mm-btn danger" onClick={() => void quitApplication()}>
              <span className="mm-btn-label">Quit</span>
              <span className="mm-btn-hint mono">CLOSE APP</span>
            </button>
          )}
        </div>

        <div className="mm-foot mono">
          Single-player · No microtransactions · Saves are local · Export to back up
        </div>
      </div>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      <SettingsHost open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="about-overlay" role="dialog" aria-label="About Sentinel Ascent">
      <div className="about-card">
        <div className="about-head">
          <div className="mono about-tag">ABOUT</div>
          <button className="pill" onClick={onClose}>✕ Close · Esc</button>
        </div>
        <div className="about-body">
          <div className="about-title">Sentinel Ascent</div>
          <div className="about-version mono">v0.1.0 · Phase 16 build</div>
          <p className="about-blurb">
            A radial survival-defense incremental for PC and tablet. A stationary Sentinel at the
            center of the Grid holds off escalating cycles of hostile drones and constructs.
            Layered permanent progression across the Forge, Research Bay, Protocols, Augments,
            Arsenals, Constructs, Heirlooms, the Order, the Warden, and the Archive tech tree.
          </p>
          <div className="about-section">
            <div className="mono about-section-head">Identity</div>
            <div className="about-line">
              Single-player. No microtransactions. Every premium pathway in the source genre has an
              in-game progression equivalent. Saves are local; export JSON to back them up or move
              between PC and tablet.
            </div>
          </div>
          <div className="about-section">
            <div className="mono about-section-head">Tech</div>
            <div className="about-line">
              TypeScript · PixiJS · Zustand · IndexedDB · Tauri 2 · PWA. Deterministic 60 Hz
              fixed-step simulation with interpolated render. Seeded PRNG with byte-identical
              mid-run snapshot resume.
            </div>
          </div>
          <div className="about-section">
            <div className="mono about-section-head">Credits</div>
            <div className="about-line">
              Design, engineering, and systems: the build team behind the Sentinel Ascent PRD set
              in <code>docs/my_game/</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
