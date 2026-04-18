/**
 * Settings overlay — audio, accessibility, performance toggles.
 *
 * Spec: docs/my_game/11-build-roadmap.md Phase 15 (low-VFX, reduced-motion,
 * color-blind palettes) + Phase 16 (full settings surface; this Phase 15 slice
 * delivers the accessibility subset).
 *
 * Toggles mutate `slot.settings` and commit via `writeSlot`. A side-effect
 * applies class-name toggles on `<html>` so CSS can respond:
 *   - `html.low-vfx` — reduces particle counts + disables expensive VFX
 *   - `html.reduced-motion` — stops all keyframe animations
 *   - `html[data-palette="deuteranopia"]` — remaps threat / prism / cyan palette
 */

import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore.ts";
import { useSaveStore } from "../../store/saveStore.ts";
import { writeSlot } from "../../save/repository.ts";
import type { SettingsState } from "../../save/schema.ts";
import {
  clearTelemetry,
  downloadTelemetry,
  setTelemetryEnabled,
  telemetryCount,
} from "../../platform/telemetry.ts";

export function SettingsHost({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return <SettingsScreen onClose={onClose} />;
}

export function applySettingsSideEffects(settings: SettingsState): void {
  const root = document.documentElement;
  root.classList.toggle("low-vfx", settings.lowVfx);
  root.classList.toggle("reduced-motion", settings.reducedMotion);
  root.dataset.palette = settings.colorBlindPalette;
  // Phase 17: opt-in telemetry.
  setTelemetryEnabled(!!settings.telemetryOptIn);
}

function SettingsScreen({ onClose }: { onClose: () => void }) {
  const slot = useAppStore((s) => s.activeSlot);
  const flash = useSaveStore((s) => s.flash);
  if (!slot) return null;

  const update = (patch: Partial<SettingsState>): void => {
    slot.settings = { ...slot.settings, ...patch };
    applySettingsSideEffects(slot.settings);
    void writeSlot(slot).then(() => flash());
  };

  const settings = slot.settings;

  return (
    <div className="screen open" id="settings-screen">
      <div className="screen-head">
        <div className="crumbs">
          <span className="parent">Hangar</span>
          <span className="sep">·</span>
          <span className="name">Settings</span>
        </div>
        <div className="chips-mini" style={{ marginLeft: "auto" }}>
          <button className="pill" onClick={onClose}>✕ Close · Esc</button>
        </div>
      </div>

      <div className="screen-body settings-body">
        <section className="settings-section">
          <h3 className="settings-head">Accessibility</h3>

          <Row
            label="Reduced motion"
            hint="Disables keyframe animations (defeat fade, rail pulse, countdown)."
          >
            <Toggle
              on={settings.reducedMotion}
              onChange={(v) => update({ reducedMotion: v })}
            />
          </Row>

          <Row
            label="Low VFX mode"
            hint="Reduces particle counts and skips expensive visual effects. Boosts fps on tablets."
          >
            <Toggle on={settings.lowVfx} onChange={(v) => update({ lowVfx: v })} />
          </Row>

          <Row label="Color-blind palette" hint="Remaps threat / prism / cyan for common dichromacies.">
            <select
              className="settings-select"
              value={settings.colorBlindPalette}
              onChange={(e) => update({ colorBlindPalette: e.target.value as SettingsState["colorBlindPalette"] })}
            >
              <option value="default">Default</option>
              <option value="deuteranopia">Deuteranopia (red-green)</option>
              <option value="protanopia">Protanopia (red-green, variant)</option>
              <option value="tritanopia">Tritanopia (blue-yellow)</option>
            </select>
          </Row>
        </section>

        <section className="settings-section">
          <h3 className="settings-head">Audio</h3>
          <Row label="Master volume" hint="Overall game audio. Audio engine wires up in Phase 17.">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.audioVolume}
              onChange={(e) => update({ audioVolume: Number(e.target.value) })}
            />
            <span className="mono settings-value">{Math.round(settings.audioVolume * 100)}%</span>
          </Row>
          <Row label="Music volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => update({ musicVolume: Number(e.target.value) })}
            />
            <span className="mono settings-value">{Math.round(settings.musicVolume * 100)}%</span>
          </Row>
          <Row label="SFX volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => update({ sfxVolume: Number(e.target.value) })}
            />
            <span className="mono settings-value">{Math.round(settings.sfxVolume * 100)}%</span>
          </Row>
          <Row label="Mute auto-buy blip" hint="Silences the small click on auto-procurement purchases.">
            <Toggle on={settings.muteAutoBuy} onChange={(v) => update({ muteAutoBuy: v })} />
          </Row>
        </section>

        <section className="settings-section">
          <h3 className="settings-head">Input</h3>
          <Row label="Pause key" hint="Keyboard binding for run pause.">
            <KeyBinder
              value={settings.keyBindings.pause}
              fallback="Space"
              onChange={(v) => update({ keyBindings: { ...settings.keyBindings, pause: v } })}
            />
          </Row>
          <Row label="Speed up key" hint="Cycle game speed 1× → 2× → 3×.">
            <KeyBinder
              value={settings.keyBindings.speedUp}
              fallback="BracketRight"
              onChange={(v) => update({ keyBindings: { ...settings.keyBindings, speedUp: v } })}
            />
          </Row>
          <Row label="Open Loadout" hint="Opens the in-run Loadout overlay.">
            <KeyBinder
              value={settings.keyBindings.openLoadout}
              fallback="KeyL"
              onChange={(v) => update({ keyBindings: { ...settings.keyBindings, openLoadout: v } })}
            />
          </Row>
          <Row label="Open Research Bay">
            <KeyBinder
              value={settings.keyBindings.openResearch}
              fallback="KeyR"
              onChange={(v) => update({ keyBindings: { ...settings.keyBindings, openResearch: v } })}
            />
          </Row>
          <Row label="Gamepad deadzone" hint="Ignore thumbstick noise below this threshold.">
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={settings.gamepadDeadzone}
              onChange={(e) => update({ gamepadDeadzone: Number(e.target.value) })}
            />
            <span className="mono settings-value">{(settings.gamepadDeadzone * 100).toFixed(0)}%</span>
          </Row>
        </section>

        <section className="settings-section">
          <h3 className="settings-head">Telemetry</h3>
          <Row
            label="Anonymous telemetry"
            hint="Opt-in. Captures session length, cycle milestones, and crash reports locally. Never personal data. No network — the queue is stored on your device only."
          >
            <Toggle on={settings.telemetryOptIn} onChange={(v) => update({ telemetryOptIn: v })} />
          </Row>
          {settings.telemetryOptIn && (
            <Row
              label="Local telemetry queue"
              hint="Download the captured JSON to attach to a bug report, or clear it."
            >
              <div className="telemetry-actions">
                <span className="mono settings-value">{telemetryCount()} events</span>
                <button className="lo-btn" onClick={() => downloadTelemetry()}>
                  DOWNLOAD JSON
                </button>
                <button className="lo-btn" onClick={() => clearTelemetry()}>
                  CLEAR
                </button>
              </div>
            </Row>
          )}
        </section>
      </div>
    </div>
  );
}

/** Click to rebind — next KeyboardEvent sets the binding. */
function KeyBinder({
  value,
  fallback,
  onChange,
}: {
  value: string | null;
  fallback: string;
  onChange: (code: string | null) => void;
}) {
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault();
      if (e.key === "Escape") {
        setCapturing(false);
        return;
      }
      onChange(e.code);
      setCapturing(false);
    };
    window.addEventListener("keydown", handler, { once: true });
    return () => window.removeEventListener("keydown", handler);
  }, [capturing, onChange]);

  const label = capturing ? "Press any key…" : (value ?? fallback);
  return (
    <div className="key-binder">
      <button
        className={`settings-keybind${capturing ? " capturing" : ""}`}
        onClick={() => setCapturing(true)}
      >
        {label}
      </button>
      {value != null && !capturing && (
        <button
          className="settings-keybind-reset"
          onClick={() => onChange(null)}
          title="Reset to default"
        >
          ↺
        </button>
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <div className="settings-row-name">{label}</div>
        {hint && <div className="settings-row-hint mono">{hint}</div>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`settings-toggle${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}
