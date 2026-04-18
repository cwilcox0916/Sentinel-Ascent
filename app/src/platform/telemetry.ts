/**
 * Telemetry — opt-in only.
 *
 * Spec: docs/my_game/05-currencies-and-economy.md §19 + roadmap Phase 17.
 *
 * No network. Events are queued in-memory and mirrored to localStorage for
 * crash-survivability. The player downloads the queue as a JSON file from
 * Settings → Telemetry → "Download telemetry" and attaches it to a bug report
 * out-of-band (GitHub issue, Discord, email). This is consistent with the
 * "local saves, no tracking, no ads" promise.
 *
 * Events are small (~50 B each) and capped at MAX_EVENTS so long sessions
 * don't grow unbounded.
 */

const STORAGE_KEY = "sentinel-ascent/telemetry";
const MAX_EVENTS = 500;
const SCHEMA_VERSION = 1;

export type TelemetryEventKind =
  | "session-start"
  | "session-end"
  | "run-start"
  | "run-end"
  | "cycle-milestone"
  | "behemoth-killed"
  | "boon-chosen"
  | "protocol-equipped"
  | "arsenal-acquired"
  | "research-completed"
  | "fleet-encountered"
  | "defeat"
  | "crash"
  | "warning";

export type TelemetryEvent = {
  t: number; // epoch ms
  kind: TelemetryEventKind;
  data?: Record<string, unknown>;
};

type StoredPayload = {
  schema: number;
  installId: string;
  events: TelemetryEvent[];
};

let enabled = false;
let installId: string = "";
let buffer: TelemetryEvent[] = [];
let flushTimer: number | null = null;

/** Called from Settings whenever the telemetry toggle changes. */
export function setTelemetryEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    // Wipe the queue + storage when opt-out.
    buffer = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return;
  }
  // Load existing buffer from storage.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPayload;
      if (parsed.schema === SCHEMA_VERSION && Array.isArray(parsed.events)) {
        buffer = parsed.events.slice(-MAX_EVENTS);
        installId = parsed.installId || newInstallId();
      }
    }
  } catch { /* ignore corrupt storage */ }
  if (!installId) installId = newInstallId();
  logEvent("session-start", { userAgent: navigator.userAgent.slice(0, 120) });
}

export function isTelemetryEnabled(): boolean {
  return enabled;
}

export function logEvent(kind: TelemetryEventKind, data?: Record<string, unknown>): void {
  if (!enabled) return;
  buffer.push({ t: Date.now(), kind, data });
  if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    persist();
  }, 2000);
}

function persist(): void {
  if (!enabled) return;
  try {
    const payload: StoredPayload = { schema: SCHEMA_VERSION, installId, events: buffer };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* storage full / private mode — ignore */ }
}

/** Called by the SettingsHost "Download telemetry" button. */
export function downloadTelemetry(): void {
  const payload: StoredPayload = { schema: SCHEMA_VERSION, installId, events: buffer };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `sentinel-ascent-telemetry-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearTelemetry(): void {
  buffer = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function telemetryCount(): number {
  return buffer.length;
}

/** Install the global error + unhandled-rejection handlers. Safe to call once at boot. */
export function installCrashHandlers(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    logEvent("crash", {
      message: String(e.message ?? "Unknown error").slice(0, 240),
      source: String(e.filename ?? "").slice(0, 120),
      line: e.lineno ?? 0,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const msg = reason && typeof reason === "object" && "message" in reason
      ? String((reason as { message: unknown }).message)
      : String(reason);
    logEvent("crash", { message: msg.slice(0, 240), kind: "unhandledrejection" });
  });
  window.addEventListener("beforeunload", () => {
    logEvent("session-end");
    persist();
  });
}

function newInstallId(): string {
  // 16 chars of crypto-random hex. No PII — just a per-install correlation id.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
