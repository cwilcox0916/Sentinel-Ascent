/**
 * Run Log — an off-sim telemetry buffer driven by the host (Stage.tsx).
 *
 * Not part of RunState → not serialized in snapshots → does not affect
 * determinism. Resuming a mid-run snapshot starts a fresh Run Log at
 * that resume point, which is acceptable (the sparkline / timeline are
 * presentational, not gameplay-critical).
 *
 * Feeds the Defeat overlay per docs/my_game/10-design-system.md §6.3:
 *   - HP-over-time sparkline  → `hpSamples`
 *   - Key Events timeline     → `events`
 *   - Peak DPS stat           → rolling 3-second window over `damageWindow`
 *   - Runtime, kills, etc.    → counters
 */

export type HpSample = {
  /** Wall-clock ms since run started. */
  tMs: number;
  /** Cycle at sample time. */
  cycle: number;
  /** HP fraction 0..1. */
  hpFrac: number;
};

export type LogEventKind = "good" | "bad" | "event" | "death";

export type LogEvent = {
  tMs: number;
  cycle: number;
  kind: LogEventKind;
  /** Short label that renders on the sparkline marker (max ~6 chars). */
  tag?: string;
  message: string;
};

/** Rolling DPS sample (1 per summary tick). */
type DpsWindowEntry = { tMs: number; damage: number };

export type RunLogSnapshot = {
  startedAt: number;
  endedAt: number;
  runtimeMs: number;
  cyclesReached: number;
  kills: number;
  peakDps: number;
  barrierHeldMs: number; // reserved for when Barrier ships
  hpSamples: HpSample[];
  events: LogEvent[];
};

const DPS_WINDOW_MS = 3000;
const HP_SAMPLE_MIN_INTERVAL_MS = 450; // ~2 Hz
const MAX_HP_SAMPLES = 240;
const MAX_EVENTS = 60;

export class RunLog {
  readonly startedAt: number;
  private hpSamples: HpSample[] = [];
  private events: LogEvent[] = [];
  private lastSampleAt = -Infinity;
  private dpsWindow: DpsWindowEntry[] = [];
  private peakDps = 0;
  private kills = 0;
  private barrierHeldMs = 0;

  constructor(startedAt: number = Date.now()) {
    this.startedAt = startedAt;
  }

  sampleHp(hpFrac: number, cycle: number, now: number = Date.now()): void {
    const t = now - this.startedAt;
    if (t - this.lastSampleAt < HP_SAMPLE_MIN_INTERVAL_MS) return;
    this.lastSampleAt = t;
    this.hpSamples.push({ tMs: t, cycle, hpFrac });
    if (this.hpSamples.length > MAX_HP_SAMPLES) this.hpSamples.shift();
  }

  pushEvent(kind: LogEventKind, message: string, cycle: number, tag?: string, now: number = Date.now()): void {
    const ev: LogEvent = { tMs: now - this.startedAt, cycle, kind, message };
    if (tag) ev.tag = tag;
    this.events.push(ev);
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }

  /** Record damage dealt this summary-tick. Rolling max over DPS_WINDOW_MS → peakDps. */
  recordDamage(damage: number, now: number = Date.now()): void {
    if (damage <= 0) return;
    const t = now - this.startedAt;
    this.dpsWindow.push({ tMs: t, damage });
    const cutoff = t - DPS_WINDOW_MS;
    while (this.dpsWindow.length && this.dpsWindow[0]!.tMs < cutoff) {
      this.dpsWindow.shift();
    }
    const windowTotal = this.dpsWindow.reduce((a, b) => a + b.damage, 0);
    const dps = windowTotal / (DPS_WINDOW_MS / 1000);
    if (dps > this.peakDps) this.peakDps = dps;
  }

  addKills(n: number): void {
    if (n > 0) this.kills += n;
  }

  get hasAnySamples(): boolean {
    return this.hpSamples.length > 0;
  }

  snapshot(endedAt: number, cyclesReached: number): RunLogSnapshot {
    return {
      startedAt: this.startedAt,
      endedAt,
      runtimeMs: Math.max(0, endedAt - this.startedAt),
      cyclesReached,
      kills: this.kills,
      peakDps: Math.round(this.peakDps * 10) / 10,
      barrierHeldMs: this.barrierHeldMs,
      hpSamples: this.hpSamples.slice(),
      events: this.events.slice(),
    };
  }
}
