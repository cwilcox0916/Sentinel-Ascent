import { useEffect, useState } from "react";
import { useAppStore } from "../../store/appStore.ts";
import { writeSlot } from "../../save/repository.ts";
import { STRATA, getStratum, isStratumUnlocked, maxUnlockedStratum, type StratumDef } from "../../meta/strata.ts";
import { LaunchCountdown } from "./LaunchCountdown.tsx";
import { VaultHost } from "./Vault.tsx";
import { SettingsHost, applySettingsSideEffects } from "./Settings.tsx";
import { getDailyDropStatus } from "../../econ/dailyDrop.ts";

/**
 * Hangar — meta hub between Title and in-game. Locked structure per
 * docs/my_game/10-design-system.md §6.2.
 *
 * Layout: header (breadcrumb + chips + Title pill) + body grid:
 *   banner (spans all)
 *   [ Sentinel list | Hero (blueprint + stats + loadout) | Right col (stratum + last run + launch) ]
 *   [ Heirloom strip aligned under hero ]
 */
export function Hangar() {
  const slot = useAppStore((s) => s.activeSlot);
  const setRoute = useAppStore((s) => s.setRoute);
  const [selectedStratum, setSelectedStratum] = useState<number>(slot?.selectedStratum ?? 1);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setTick] = useState(0);

  // Phase 15: apply settings classes on every Hangar mount so the palette/VFX
  // toggles take effect immediately when switching into the Hangar.
  useEffect(() => {
    if (slot) applySettingsSideEffects(slot.settings);
  }, [slot]);

  useEffect(() => {
    // Esc → back to title.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !countdownOpen) setRoute("title");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [countdownOpen, setRoute]);

  // Countdown clock for the banner
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!slot) {
    // No slot — bail back to title
    useAppStore.getState().setRoute("title");
    return null;
  }

  const maxUnlocked = maxUnlockedStratum(slot.metadata.highestCycle);
  const stratumDef = getStratum(selectedStratum);

  async function handleSelectStratum(id: number): Promise<void> {
    if (!slot) return;
    if (!isStratumUnlocked(id, slot.metadata.highestCycle)) return;
    setSelectedStratum(id);
    slot.selectedStratum = id;
    await writeSlot(slot);
  }

  async function handleLaunch(): Promise<void> {
    if (!slot) return;
    // Stamp the Stratum onto the slot; Stage reads it at run start.
    slot.selectedStratum = selectedStratum;
    // Discard any existing run snapshot — Launch starts a fresh deterministic run.
    slot.runSnapshot = null;
    slot.runsLaunched += 1;
    await writeSlot(slot);
    setCountdownOpen(true);
  }

  function handleCountdownComplete(): void {
    setCountdownOpen(false);
    useAppStore.getState().setRoute("in-game");
  }

  function handleResumeRun(): void {
    setRoute("in-game");
  }

  const hasRunInProgress = !!slot.runSnapshot;

  return (
    <div className="screen open" id="hangar-screen">
      <HangarHeader
        displayName={slot.profile.displayName}
        alloy={slot.currencies.alloy}
        catalyst={slot.currencies.catalyst}
        prisms={slot.currencies.prisms}
        cipher={slot.currencies.cipherKeys}
        dailyReady={getDailyDropStatus(slot.dailyDrop, Date.now()).ready}
        onTitle={() => setRoute("title")}
        onVault={() => setVaultOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <div className="hangar-body">
        <ModifierBanner />

        <SentinelList activeSentinel="vigil" />

        <HeroCard
          sentinelName={slot.profile.displayName}
          highestCycle={slot.metadata.highestCycle}
          clears={slot.runsLaunched}
        />

        <div className="hg-right-col">
          <div className="hg-stratum">
            <div className="hg-sec-head">
              <span className="h">STRATUM</span>
              <span className="m mono">MAX REACHED · {String(maxUnlocked).padStart(2, "0")}</span>
            </div>
            <StratumLadder
              selected={selectedStratum}
              maxUnlocked={maxUnlocked}
              highestCycle={slot.metadata.highestCycle}
              onSelect={(id) => void handleSelectStratum(id)}
            />
            <div className="hg-launch">
              <div className="stratum-reminder mono">
                <span className="k">STRATUM / MODS</span>
                <span className="v">
                  {String(selectedStratum).padStart(2, "0")} · {stratumDef.name}
                </span>
              </div>
              {hasRunInProgress ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="launch-btn" onClick={handleResumeRun} style={{ padding: "12px" }}>
                    ▶ Resume Run
                  </div>
                  <div
                    className="pill"
                    style={{ justifyContent: "center" }}
                    onClick={() => void handleLaunch()}
                  >
                    ⟲ Abandon · New Run
                  </div>
                </div>
              ) : (
                <div className="launch-btn" onClick={() => void handleLaunch()}>
                  ▶ Launch Run
                </div>
              )}
            </div>
          </div>

          <LastRunCard slot={slot} />
        </div>

        <HeirloomStrip />
      </div>

      {countdownOpen && <LaunchCountdown onComplete={handleCountdownComplete} />}
      <VaultHost open={vaultOpen} onClose={() => setVaultOpen(false)} />
      <SettingsHost open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* ---------------- Header ---------------- */
function HangarHeader(props: {
  displayName: string;
  alloy: number;
  catalyst: number;
  prisms: number;
  cipher: number;
  dailyReady: boolean;
  onTitle: () => void;
  onVault: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="screen-head">
      <div className="hg-crumbs">
        <div className="logo logo-img" style={{ width: 22, height: 22 }}>
          <img src="/icon-128.png" alt="Sentinel Ascent" />
        </div>
        <span className="name">HANGAR</span>
        <span className="parent" style={{ marginLeft: 12, color: "var(--fg-dim)" }}>
          {props.displayName}
        </span>
      </div>
      <div className="chips-mini">
        <div className="chip-mini alloy">
          <span className="lbl">Alloy</span>
          <span className="v mono">{formatBig(props.alloy)}</span>
        </div>
        <div className="chip-mini catalyst">
          <span className="lbl">Catalyst</span>
          <span className="v mono">{formatBig(props.catalyst)}</span>
        </div>
        <div className="chip-mini prism">
          <span className="lbl">Prisms</span>
          <span className="v mono">{formatBig(props.prisms)}</span>
        </div>
        <div className="chip-mini cipher">
          <span className="lbl">Cipher</span>
          <span className="v mono">{formatBig(props.cipher)}</span>
        </div>
        <span
          className={`pill vault-pill${props.dailyReady ? " hot" : ""}`}
          onClick={props.onVault}
          title="Daily Drop + Achievement Vault"
        >
          ◆ Vault{props.dailyReady ? " · DROP" : ""}
        </span>
        <span className="pill" onClick={props.onSettings} title="Settings">⚙ Settings</span>
        <span className="pill" onClick={props.onTitle}>↩ Title · Esc</span>
        <span
          className="pill"
          onClick={() => useAppStore.getState().setRoute("main-menu")}
          title="Main Menu"
        >
          ⌂ Menu
        </span>
      </div>
    </div>
  );
}

/* ---------------- Modifier banner ---------------- */
function ModifierBanner() {
  // Phase 7 ships a static stub. Phase 12 hooks real daily/weekly state.
  return (
    <div className="hg-banner">
      <div className="bseg daily">
        <span className="btag mono">DAILY MUTATOR</span>
        <div>
          <div className="bname">Stable Sky</div>
          <div className="bdesc">No active mutators today — clean run conditions.</div>
        </div>
      </div>
      <div className="bseg weekly">
        <span className="btag mono">WEEKLY TRIAL</span>
        <div>
          <div className="bname">Stratum {Math.min(9, 9)} · Seeded</div>
          <div className="bdesc">Phase 13 ships the trial. Seeded run arrives with the Order system.</div>
        </div>
      </div>
      <div className="bseg" style={{ flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
        <div className="cd-label">Season rotates in</div>
        <div className="countdown mono">— · —</div>
      </div>
    </div>
  );
}

/* ---------------- Sentinel list ---------------- */
function SentinelList({ activeSentinel }: { activeSentinel: string }) {
  const sentinels = [
    { id: "vigil", name: "Vigil-07", className: "BULWARK · MK IV", level: 1, unlocked: true },
    { id: "rend", name: "Rend-02", className: "LANCE · MK III", level: 0, unlocked: false, lockLabel: "Phase 10" },
    { id: "echo", name: "Echo-11", className: "BROADCAST · MK II", level: 0, unlocked: false, lockLabel: "Phase 10" },
    { id: "classified1", name: "Classified", className: "STRATUM 10", level: 0, unlocked: false, lockLabel: "Locked" },
  ];

  return (
    <aside className="hg-sentinels">
      <div className="hg-sec-head">
        <span className="h">SENTINELS</span>
        <span className="m mono">1 / {sentinels.length} UNLOCKED</span>
      </div>
      <div className="hg-sentinel-list">
        {sentinels.map((s) => (
          <div
            key={s.id}
            className={`sentinel-row${activeSentinel === s.id ? " active" : ""}${!s.unlocked ? " locked" : ""}`}
          >
            <div className="sentinel-crest">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                {s.unlocked ? (
                  <>
                    <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
                    <circle cx="12" cy="12" r="3.5" />
                  </>
                ) : (
                  <>
                    <rect x="6" y="11" width="12" height="9" rx="1" />
                    <path d="M9 11 V8 a3 3 0 0 1 6 0 V11" />
                  </>
                )}
              </svg>
            </div>
            <div>
              <div className="s-name">{s.name}</div>
              <div className="s-class mono">{s.className}</div>
            </div>
            <div className="s-lvl mono">
              {s.unlocked ? `L ${String(s.level).padStart(2, "0")}` : s.lockLabel ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ---------------- Hero blueprint ---------------- */
function HeroCard({ sentinelName, highestCycle, clears }: { sentinelName: string; highestCycle: number; clears: number }) {
  return (
    <section className="hg-hero">
      <div className="hg-hero-head">
        <div>
          <div className="title">VIGIL-07</div>
          <div className="subtitle mono">BULWARK CLASS · MK IV · OPERATOR {sentinelName.toUpperCase()}</div>
        </div>
        <div className="sentinel-meta">
          <div className="meta-item">
            <div className="mk">Mastery</div>
            <div className="mv mono">L 01</div>
          </div>
          <div className="meta-item">
            <div className="mk">Best Cycle</div>
            <div className="mv mono">{highestCycle}</div>
          </div>
          <div className="meta-item">
            <div className="mk">Clears</div>
            <div className="mv mono">{clears}</div>
          </div>
        </div>
      </div>

      <div className="hg-hero-stage">
        <span className="callout co-1 mono">Augment Nodes · 0/8</span>
        <span className="callout co-2 mono">Barrier Matrix · Locked</span>
        <span className="callout co-3 mono">Core Reactor · 100%</span>
        <span className="callout co-4 mono">Frame Integrity · 100%</span>
        <div className="scanline" />
        <svg className="blueprint" viewBox="0 0 560 340" fill="none" stroke="#6ee7ff" strokeWidth="1.2">
          {/* Outer silhouette */}
          <g opacity="0.35">
            <path d="M 280 20 L 420 80 L 460 180 L 420 280 L 280 320 L 140 280 L 100 180 L 140 80 Z" />
            <path d="M 280 40 L 400 90 L 440 180 L 400 270 L 280 300 L 160 270 L 120 180 L 160 90 Z" />
          </g>
          {/* Frame plates */}
          <g opacity="0.7">
            <path d="M 280 50 L 380 95 L 410 180 L 380 265 L 280 290 L 180 265 L 150 180 L 180 95 Z" />
            <line x1="280" y1="50" x2="280" y2="290" />
            <line x1="150" y1="180" x2="410" y2="180" />
            <line x1="180" y1="95" x2="380" y2="265" />
            <line x1="380" y1="95" x2="180" y2="265" />
          </g>
          {/* Core reactor */}
          <circle cx="280" cy="180" r="48" strokeWidth="1.4" />
          <circle cx="280" cy="180" r="32" opacity="0.5" />
          <circle cx="280" cy="180" r="14" strokeWidth="1.6" />
          <circle cx="280" cy="180" r="4" fill="#6ee7ff" stroke="none" />
          {/* Augment nodes — unfilled at L1 */}
          <g opacity="0.35">
            <circle cx="280" cy="80" r="5" strokeDasharray="2 2" />
            <circle cx="380" cy="125" r="5" strokeDasharray="2 2" />
            <circle cx="380" cy="235" r="5" strokeDasharray="2 2" />
            <circle cx="280" cy="280" r="5" strokeDasharray="2 2" />
            <circle cx="180" cy="235" r="5" strokeDasharray="2 2" />
            <circle cx="180" cy="125" r="5" strokeDasharray="2 2" />
            <circle cx="340" cy="75" r="5" strokeDasharray="2 2" />
            <circle cx="220" cy="75" r="5" strokeDasharray="2 2" />
          </g>
          {/* Emitters */}
          <g strokeWidth="1.3">
            <path d="M 100 170 L 60 170 L 60 190 L 100 190 Z" fill="rgba(110,231,255,0.15)" />
            <path d="M 460 170 L 500 170 L 500 190 L 460 190 Z" fill="rgba(110,231,255,0.15)" />
            <circle cx="70" cy="180" r="3" fill="#6ee7ff" stroke="none" />
            <circle cx="490" cy="180" r="3" fill="#6ee7ff" stroke="none" />
          </g>
          <circle cx="280" cy="180" r="140" strokeDasharray="3 5" opacity="0.25" />
          <g fontFamily="JetBrains Mono" fontSize="8" fill="#6ee7ff" opacity="0.5" stroke="none">
            <text x="470" y="40">VIG-07 / MK IV</text>
            <text x="20" y="40">01 / 06</text>
            <text x="20" y="330">SCALE 1:1</text>
            <text x="420" y="330">PLT-A · REV 01</text>
          </g>
          <g opacity="0.5">
            <path d="M 10 10 L 30 10 L 30 30" />
            <path d="M 550 10 L 530 10 L 530 30" />
            <path d="M 10 330 L 30 330 L 30 310" />
            <path d="M 550 330 L 530 330 L 530 310" />
          </g>
        </svg>
      </div>

      <div className="hg-hero-stats">
        <div className="hg-stat-cell"><span className="sk">Health</span><span className="sv mono">100</span><span className="sd mono">base</span></div>
        <div className="hg-stat-cell"><span className="sk">Damage</span><span className="sv mono">8</span><span className="sd mono">base</span></div>
        <div className="hg-stat-cell"><span className="sk">Barrier</span><span className="sv mono">—</span><span className="sd mono">Phase 5</span></div>
        <div className="hg-stat-cell"><span className="sk">Range</span><span className="sv mono">280</span><span className="sd mono">base</span></div>
        <div className="hg-stat-cell"><span className="sk">Attack Spd</span><span className="sv mono">2.00/s</span><span className="sd mono">base</span></div>
      </div>

      <div className="hg-loadout">
        <div className="lo-slot"><span className="edit mono">EDIT</span><span className="lk mono">Protocols · 0/0</span><span className="lv">Unassigned</span><span className="ls mono">Phase 10</span></div>
        <div className="lo-slot"><span className="edit mono">EDIT</span><span className="lk mono">Augments · 0/0</span><span className="lv">Unassigned</span><span className="ls mono">Phase 10</span></div>
        <div className="lo-slot"><span className="edit mono">EDIT</span><span className="lk mono">Arsenal</span><span className="lv">—</span><span className="ls mono">Phase 10</span></div>
        <div className="lo-slot"><span className="edit mono">EDIT</span><span className="lk mono">Auto-Procurement</span><span className="lv">Tier 1+</span><span className="ls mono">In Research</span></div>
      </div>
    </section>
  );
}

/* ---------------- Stratum ladder ---------------- */
function StratumLadder({
  selected,
  maxUnlocked,
  highestCycle,
  onSelect,
}: {
  selected: number;
  maxUnlocked: number;
  highestCycle: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="stratum-ladder">
      {STRATA.map((s) => (
        <StratumRow
          key={s.id}
          def={s}
          selected={selected === s.id}
          current={selected === s.id}
          locked={!isStratumUnlocked(s.id, highestCycle)}
          isMax={s.id === maxUnlocked}
          onSelect={() => onSelect(s.id)}
        />
      ))}
    </div>
  );
}

function StratumRow({
  def, selected, current, locked, isMax, onSelect,
}: {
  def: StratumDef;
  selected: boolean;
  current: boolean;
  locked: boolean;
  isMax: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`stratum-row${selected ? " active" : ""}${current ? " current" : ""}${locked ? " locked" : ""}`}
      onClick={locked ? undefined : onSelect}
    >
      <div className="snum mono">{String(def.id).padStart(2, "0")}</div>
      <div>
        <div className="sname">{def.name}</div>
        <div className="sflavor mono">{def.flavor}</div>
      </div>
      <div className="s-mod">
        {locked ? (
          <span className="rec mono">LOCK · {def.unlockCycle}</span>
        ) : isMax ? (
          <span className="rec current mono">MAX</span>
        ) : def.recommended ? (
          <span className="rec current mono">START</span>
        ) : (
          <span className="best mono">×{def.baseScale.toFixed(1)}</span>
        )}
        {def.modifiers.length > 0 && (
          <span className="best mono" style={{ color: "#f3a54a" }}>{def.modifiers.length} mod{def.modifiers.length === 1 ? "" : "s"}</span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Last run card ---------------- */
function LastRunCard({ slot }: { slot: NonNullable<ReturnType<typeof useAppStore.getState>["activeSlot"]> }) {
  const last = slot.lastRun;
  return (
    <div className="hg-last-run">
      <div className="lrn">
        <span className="h">LAST RUN</span>
        <span className="st mono">{last ? `${last.causeOfDeath.toUpperCase()} · CYCLE ${last.cyclesReached}` : "NO RUNS YET"}</span>
      </div>
      {last ? (
        <>
          <div className="lr-grid">
            <div className="lr-cell"><div className="k mono">Cycles reached</div><div className="v mono">{last.cyclesReached}</div></div>
            <div className="lr-cell"><div className="k mono">Alloy earned</div><div className="v mono">{formatBig(last.alloyEarned)}</div></div>
            <div className="lr-cell"><div className="k mono">Prisms earned</div><div className="v mono">{last.prismsEarned}</div></div>
            <div className="lr-cell"><div className="k mono">Runtime</div><div className="v mono">{formatShortDuration(last.runtimeMs)}</div></div>
          </div>
          <div className="cause mono">
            Terminated by <span>{last.causeOfDeath}</span> · Stratum {String(last.stratum).padStart(2, "0")}
          </div>
        </>
      ) : (
        <div className="cause mono" style={{ color: "var(--fg-mute)" }}>
          Queue a run to see a detailed after-action report here.
        </div>
      )}
    </div>
  );
}

/* ---------------- Heirloom strip ---------------- */
function HeirloomStrip() {
  // 6 locked placeholders. Real Heirlooms ship in Phase 11.
  return (
    <div className="hg-heirlooms">
      <div className="hl-label mono">HEIRLOOMS</div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="heirloom-cell empty">
          <span className="hname">Empty Slot</span>
          <span className="hrank">—</span>
        </div>
      ))}
      <div className="hl-more mono">Phase 11</div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */
function formatBig(n: number): string {
  if (!n) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

function formatShortDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
