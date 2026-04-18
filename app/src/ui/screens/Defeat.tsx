/**
 * Defeat — full-viewport post-run overlay.
 *
 * Locked structure per docs/my_game/10-design-system.md §6.3:
 *   - Left half: STAMP, headline SENTINEL DOWN, sub-headline, CYCLE big block,
 *     fragmented blueprint backdrop, cause-of-death card
 *   - Right half: run statistics, HP sparkline, key events timeline, reward
 *     roll-up cards, optional heirloom drop callout, CTA row
 *
 * Runtime: surfaces `useRunStore(s => s.defeat)`. Retry / Adjust / Dismiss
 * dispatch through `useAppStore`.
 */

import { useEffect, useMemo, useState } from "react";
import { useRunStore, type DefeatSummary } from "../../store/runStore.ts";
import { useAppStore } from "../../store/appStore.ts";
import type { HpSample, LogEvent } from "../../meta/runLog.ts";

const SPARKLINE_W = 520;
const SPARKLINE_H = 80;

export function Defeat() {
  const defeat = useRunStore((s) => s.defeat);
  if (!defeat) return null;
  return <DefeatInner defeat={defeat} />;
}

function DefeatInner({ defeat }: { defeat: DefeatSummary }) {
  const setDefeat = useRunStore((s) => s.setDefeat);
  const setRoute = useAppStore((s) => s.setRoute);
  const bumpRunEpoch = useAppStore((s) => s.bumpRunEpoch);
  const activeSlot = useAppStore((s) => s.activeSlot);

  const cycles = defeat.log.cyclesReached;
  const pb = defeat.personalBestCycle;
  const pbDelta = defeat.personalBestDelta;
  const runtime = formatDuration(defeat.log.runtimeMs);

  const onRetry = () => {
    // Clear any stale snapshot, re-arm for a fresh run of the same Stratum.
    if (activeSlot) {
      activeSlot.runSnapshot = null;
      activeSlot.runsLaunched += 1;
    }
    setDefeat(null);
    bumpRunEpoch();
  };

  const onAdjust = () => {
    if (activeSlot) {
      activeSlot.runSnapshot = null;
    }
    setDefeat(null);
    setRoute("hangar");
  };

  const onDismiss = () => setDefeat(null);

  // Esc → Dismiss.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="defeat-overlay" role="dialog" aria-label="Run defeated">
      <button className="df-close pill" onClick={onDismiss} aria-label="Dismiss">
        ✕ CLOSE
      </button>

      <div className="df-body">
        <div className="df-left">
          <div className="df-stamp">▲ RUN TERMINATED</div>
          <div className="df-headline">
            <div className="df-sentinel">SENTINEL</div>
            <div className="df-down">DOWN</div>
          </div>
          <div className="df-sub mono">
            RUN TERMINATED · CYCLE <span className="hot">{pad2(cycles)}</span>
          </div>

          <div className="df-cycle-big">
            <div className="df-cycle-lbl">CYCLE</div>
            <div className="df-cycle-num mono">{pad2(cycles)}</div>
            <div className={`df-cycle-pb mono ${pbDelta >= 0 ? "up" : "down"}`}>
              PB {pad2(pb)} · {pbDelta >= 0 ? "+" : ""}{pbDelta}
            </div>
          </div>

          <FragmentedSentinelSvg />

          <div className="df-cause">
            <div className="df-cause-icon">▼</div>
            <div className="df-cause-body">
              <div className="df-cause-name">{defeat.causeOfDeath}</div>
              <div className="df-cause-line">{defeat.causeDetail}</div>
            </div>
          </div>
        </div>

        <div className="df-right">
          <Section title="Run Statistics">
            <div className="df-stats-grid">
              <StatCell label="Cycles" value={String(cycles)} delta={pbDelta} />
              <StatCell label="Runtime" value={runtime} />
              <StatCell label="Peak DPS" value={formatDps(defeat.log.peakDps)} />
              <StatCell label="Kills" value={String(defeat.log.kills)} />
              <StatCell label="Scrip Earned" value={formatNumber(defeat.scripEarned)} />
              <StatCell label="Alloy Earned" value={formatNumber(defeat.alloyEarned)} />
            </div>
          </Section>

          <Section title="Frame Integrity">
            <Sparkline samples={defeat.log.hpSamples} events={defeat.log.events} />
          </Section>

          <Section title="Key Events">
            <EventsTimeline events={defeat.log.events} />
          </Section>

          <Section title="Run Yield">
            <div className="df-rewards">
              <RewardCard
                label="Alloy"
                value={defeat.rewards.alloy}
                color="var(--alloy)"
              />
              <RewardCard
                label="Catalyst"
                value={defeat.rewards.catalyst}
                color="var(--catalyst)"
              />
              <RewardCard
                label="Prisms"
                value={defeat.rewards.prisms}
                color="var(--prism)"
              />
              <RewardCard
                label="Cipher"
                value={defeat.rewards.cipher}
                color="var(--cipher)"
              />
            </div>
          </Section>

          {defeat.heirloomDrop && (
            <div className="df-heirloom">
              <div className="df-heirloom-icon">◆</div>
              <div className="df-heirloom-tag">HEIRLOOM ACQUIRED</div>
              <div className="df-heirloom-name">{defeat.heirloomDrop.name}</div>
              <div className="df-heirloom-rarity">{defeat.heirloomDrop.rarity}</div>
            </div>
          )}

          <div className="df-ctas">
            <button className="df-cta primary" onClick={onRetry}>
              RETRY · SAME LOADOUT
            </button>
            <button className="df-cta neutral" onClick={onAdjust}>
              ADJUST IN HANGAR
            </button>
            <button className="df-cta ghost" onClick={onDismiss}>
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="df-section">
      <div className="df-section-head">{props.title}</div>
      {props.children}
    </div>
  );
}

function StatCell(props: { label: string; value: string; delta?: number }) {
  const { delta } = props;
  return (
    <div className="df-stat-cell">
      <div className="df-stat-lbl">{props.label}</div>
      <div className="df-stat-val mono">{props.value}</div>
      {delta != null && delta !== 0 && (
        <div className={`df-stat-delta mono ${delta >= 0 ? "up" : "down"}`}>
          {delta >= 0 ? "+" : ""}{delta}
        </div>
      )}
    </div>
  );
}

function Sparkline({ samples, events }: { samples: HpSample[]; events: LogEvent[] }) {
  const path = useMemo(() => {
    if (samples.length < 2) return "";
    const lastT = samples[samples.length - 1]!.tMs || 1;
    const pts = samples.map((s) => {
      const x = (s.tMs / lastT) * SPARKLINE_W;
      const y = SPARKLINE_H - s.hpFrac * SPARKLINE_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [samples]);

  const tSpan = samples.length ? samples[samples.length - 1]!.tMs || 1 : 1;

  const markers = events
    .filter((e) => e.tMs <= tSpan)
    .map((e, i) => {
      const x = (e.tMs / tSpan) * SPARKLINE_W;
      const color =
        e.kind === "death"
          ? "var(--threat)"
          : e.kind === "good"
          ? "var(--prism)"
          : e.kind === "bad"
          ? "var(--threat)"
          : "var(--cyan)";
      return (
        <g key={i} data-ev={e.tag ?? ""}>
          <line
            x1={x}
            x2={x}
            y1={0}
            y2={SPARKLINE_H}
            stroke={color}
            strokeWidth={1}
            strokeDasharray={e.kind === "death" ? undefined : "2 3"}
            opacity={0.7}
          />
          {e.tag && (
            <text
              x={x + 3}
              y={10}
              fontSize={8}
              fill={color}
              fontFamily="JetBrains Mono, monospace"
              letterSpacing={1}
            >
              {e.tag}
            </text>
          )}
        </g>
      );
    });

  if (samples.length < 2) {
    return (
      <div className="df-sparkline empty">
        <span className="mono">No telemetry captured (run ended too quickly)</span>
      </div>
    );
  }

  return (
    <svg
      className="df-sparkline"
      viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="df-hp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${SPARKLINE_W},${SPARKLINE_H} L 0,${SPARKLINE_H} Z`} fill="url(#df-hp-fill)" />
      <path d={path} fill="none" stroke="var(--cyan)" strokeWidth={1.4} />
      {markers}
    </svg>
  );
}

function EventsTimeline({ events }: { events: LogEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="df-events empty mono">
        No key events this run.
      </div>
    );
  }
  return (
    <ul className="df-events">
      {events.slice().reverse().map((e, i) => (
        <li key={i} className={`df-event ${e.kind}`}>
          <span className="df-event-t mono">{formatTimestamp(e.tMs)}</span>
          <span className={`df-event-dot ${e.kind}`} />
          <span className="df-event-msg">{e.message}</span>
        </li>
      ))}
    </ul>
  );
}

function RewardCard(props: { label: string; value: number; color: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    // Counter roll-up: animate from 0 to value over 1.5s (counterFlash).
    const start = performance.now();
    const duration = 1500;
    const target = props.value;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.floor(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [props.value]);
  return (
    <div className="df-reward" style={{ ["--stripe" as never]: props.color }}>
      <div className="df-reward-lbl">{props.label}</div>
      <div className="df-reward-val mono" data-flash={props.value > 0 ? "1" : "0"}>
        +{formatNumber(display)}
      </div>
    </div>
  );
}

function FragmentedSentinelSvg() {
  // Faint fractured-blueprint backdrop, ~0.16 opacity per spec.
  return (
    <svg className="df-fragments" viewBox="-100 -100 200 200" aria-hidden>
      <g stroke="var(--threat)" strokeWidth="0.6" fill="none" opacity="0.16">
        <polygon points="0,-80 70,-40 70,40 0,80 -70,40 -70,-40" transform="rotate(6)" />
        <polygon points="0,-50 44,-25 44,25 0,50 -44,25 -44,-25" transform="rotate(-14)" />
        <circle r="22" cx="4" cy="-3" />
        <line x1="-90" y1="-10" x2="-40" y2="6" />
        <line x1="40" y1="-12" x2="88" y2="2" />
        <line x1="-6" y1="52" x2="2" y2="92" />
      </g>
    </svg>
  );
}

/* ------- helpers ------- */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatTimestamp(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "k";
  return Math.floor(n).toString();
}

function formatDps(n: number): string {
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "k";
  return n.toFixed(1);
}
