import { useEffect, useMemo, useState } from "react";
import {
  PROJECTS,
  effectiveDurationMs,
  effectiveSpeedMultiplier,
  getProject,
  isProjectInFlight,
  isProjectOwned,
  type ProjectId,
  type ProjectLine,
  type ResearchBayState,
  type ResearchSlot,
} from "../../meta/researchBay.ts";

/**
 * Research Bay overlay. Locked structure per docs/my_game/10-design-system.md §6.1.
 *
 * Layout: screen-head (breadcrumb + mini chips + close) + 3-column body:
 *   left nav (project lines) | main (slots + AP tier ladder + Project Acceleration) | right detail
 */
export function ResearchBay({
  bay,
  currencies,
  stratum,
  currentCycle,
  onQueue,
  onQueueAfter,
  onCancelQueued,
  onClose,
}: {
  bay: ResearchBayState;
  currencies: { alloy: number; catalyst: number; prisms: number };
  stratum: number;
  currentCycle: number;
  onQueue: (id: ProjectId) => void;
  onQueueAfter: (slotIndex: number, id: ProjectId) => void;
  onCancelQueued: (slotIndex: number) => void;
  onClose: () => void;
}) {
  const [line, setLine] = useState<ProjectLine>("auto");
  const [selected, setSelected] = useState<ProjectId>("autoProcurement_T1");

  // Re-render every second so countdowns tick.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apProjects = useMemo(() => PROJECTS.filter((p) => p.line === "auto"), []);
  const accelerationProjects = useMemo(() => PROJECTS.filter((p) => p.line === "acceleration"), []);
  const overclockProjects = useMemo(() => PROJECTS.filter((p) => p.line === "overclock"), []);

  const selectedDef = getProject(selected);
  const selectedOwned = isProjectOwned(bay, selected);
  const selectedInFlight = isProjectInFlight(bay, selected);
  const selectedAffordable =
    currencies.alloy >= selectedDef.alloyCost && currencies.catalyst >= selectedDef.catalystCost;
  const selectedStratumLocked = stratum < selectedDef.stratumGate;
  const effectiveMs = effectiveDurationMs(bay, selectedDef);
  const speedMultiplier = effectiveSpeedMultiplier(bay);

  const apLevel =
    (bay.levels["autoProcurement_T4"] ?? 0) >= 1 ? 4 :
    (bay.levels["autoProcurement_T3"] ?? 0) >= 1 ? 3 :
    (bay.levels["autoProcurement_T2"] ?? 0) >= 1 ? 2 :
    (bay.levels["autoProcurement_T1"] ?? 0) >= 1 ? 1 : 0;

  return (
    <div className="screen open" id="research-screen">
      <div className="screen-head">
        <div className="crumbs">
          <span className="parent">Hangar</span>
          <span className="sep">▸</span>
          <span className="name">Research Bay</span>
        </div>
        <div className="chips-mini">
          <div className="chip-mini alloy">
            <span className="lbl">Alloy</span>
            <span className="v mono">{formatBig(currencies.alloy)}</span>
          </div>
          <div className="chip-mini catalyst">
            <span className="lbl">Catalyst</span>
            <span className="v mono">{formatBig(currencies.catalyst)}</span>
          </div>
          <div className="chip-mini prism">
            <span className="lbl">Prisms</span>
            <span className="v mono">{formatBig(currencies.prisms)}</span>
          </div>
          <span className="pill" onClick={onClose}>✕ Close · Esc</span>
        </div>
      </div>

      <div className="screen-body">
        <nav className="research-nav" id="research-nav">
          <div className="rn-head">PROJECT LINES</div>
          <NavItem
            label="Auto-Procurement"
            count={`${apLevel}/4`}
            active={line === "auto"}
            hot={line === "auto"}
            onClick={() => setLine("auto")}
          />
          <NavItem
            label="Project Acceleration"
            count={`L${bay.levels["projectAcceleration"] ?? 0}`}
            active={line === "acceleration"}
            onClick={() => setLine("acceleration")}
          />
          <NavItem
            label="Overclock"
            count={`L${bay.levels["overclock"] ?? 0}/30`}
            active={line === "overclock"}
            onClick={() => setLine("overclock")}
          />
        </nav>

        <section className="research-main" id="research-main">
          <SlotTrack slots={bay.slots} onCancelQueued={onCancelQueued} />

          {line === "auto" && (
            <>
              <div className="rm-section-head">
                <h2>Auto-Procurement · Tier Ladder</h2>
                <span className="meta">Spend Scrip automatically during a run</span>
              </div>
              <div className="tier-ladder" id="tier-ladder">
                {apProjects.map((p) => (
                  <TierCard
                    key={p.id}
                    def={p}
                    bay={bay}
                    selected={selected === p.id}
                    onSelect={() => setSelected(p.id)}
                  />
                ))}
              </div>
            </>
          )}

          {line === "acceleration" && (
            <>
              <div className="rm-section-head">
                <h2>Project Acceleration</h2>
                <span className="meta">Permanent research-speed multiplier · stacks with Overclock</span>
              </div>
              <AccelerationGauge bay={bay} onSelect={() => setSelected("projectAcceleration")} />
            </>
          )}

          {line === "overclock" && (
            <>
              <div className="rm-section-head">
                <h2>Overclock</h2>
                <span className="meta">Flat +5% research speed per level</span>
              </div>
              <div className="project-grid">
                {overclockProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    def={p}
                    bay={bay}
                    selected={selected === p.id}
                    onSelect={() => setSelected(p.id)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="rm-section-head" style={{ marginTop: 22 }}>
            <h2>Global Speed</h2>
            <span className="meta">Current multiplier from all sources</span>
          </div>
          <div className="overclock-line">
            <span className="mono">×{speedMultiplier.toFixed(2)}</span>
            <div className="gauge">
              <div className="f" style={{ width: `${Math.min(100, (speedMultiplier / 3) * 100)}%` }} />
            </div>
            <span className="val mono">base ÷ {speedMultiplier.toFixed(2)}</span>
            <span className="nx">{apProjects.length + accelerationProjects.length + overclockProjects.length} projects catalogued</span>
          </div>
        </section>

        <aside className="research-detail" id="research-detail">
          <div className="rd-head">
            <h3>{selectedDef.displayName}</h3>
            <div className="sub">
              {selectedDef.line === "auto" ? "AUTO-PROCUREMENT" :
               selectedDef.line === "acceleration" ? "ACCELERATION LINE" :
               "OVERCLOCK"}
            </div>
          </div>
          <div className="rd-body">
            <p>{selectedDef.description}</p>
            <h4>Gate</h4>
            <dl className="rd-kv">
              <dt>Stratum</dt>
              <dd>{selectedDef.stratumGate}</dd>
              <dt>Cycle</dt>
              <dd>{selectedDef.cycleGate}</dd>
              <dt>Current Cycle</dt>
              <dd>{currentCycle}</dd>
            </dl>
            <h4>Cost</h4>
            <dl className="rd-kv">
              <dt>Alloy</dt>
              <dd className={currencies.alloy < selectedDef.alloyCost ? "nope" : ""}>{formatBig(selectedDef.alloyCost)}</dd>
              <dt>Catalyst</dt>
              <dd className={currencies.catalyst < selectedDef.catalystCost ? "nope" : ""}>{formatBig(selectedDef.catalystCost)}</dd>
            </dl>
            <h4>Duration</h4>
            <dl className="rd-kv">
              <dt>Base</dt>
              <dd>{formatDuration(selectedDef.baseDurationMs)}</dd>
              <dt>Effective</dt>
              <dd style={{ color: "var(--cyan)" }}>{formatDuration(effectiveMs)}</dd>
            </dl>
          </div>
          <div className="rd-foot">
            <button
              className={`rd-action${selectedOwned ? " owned" : selectedInFlight ? " researching" : selectedStratumLocked || !selectedAffordable ? " disabled" : ""}`}
              disabled={selectedOwned || selectedInFlight || selectedStratumLocked || !selectedAffordable}
              onClick={() => onQueue(selected)}
            >
              {selectedOwned ? "Researched" :
               selectedInFlight ? "In Progress" :
               selectedStratumLocked ? `Locked · Stratum ${selectedDef.stratumGate}` :
               !selectedAffordable ? "Unaffordable" :
               "Begin Research"}
            </button>

            {/* Queue-after action: if selected project is in-flight nowhere, but we have a slot busy with another project, offer "queue after slot N" */}
            {!selectedOwned && !selectedInFlight && (
              <QueueAfterOptions
                bay={bay}
                projectId={selected}
                onQueueAfter={onQueueAfter}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function NavItem({
  label, count, active, hot, onClick,
}: { label: string; count: string; active: boolean; hot?: boolean; onClick: () => void }) {
  return (
    <div className={`rn-item${active ? " active" : ""}${hot ? " hot" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <span className="count mono">{count}</span>
    </div>
  );
}

function SlotTrack({
  slots, onCancelQueued,
}: { slots: ResearchSlot[]; onCancelQueued: (i: number) => void }) {
  return (
    <>
      <div className="rm-section-head">
        <h2>Research Slots</h2>
        <span className="meta">{slots.filter((s) => s.job !== null).length} of {slots.length} active</span>
      </div>
      <div className="slot-track">
        {slots.map((slot) => {
          const job = slot.job;
          if (!job) {
            return (
              <div key={slot.index} className="slot-cell empty">
                <span className="e">Slot {String(slot.index + 1).padStart(2, "0")} · Idle</span>
              </div>
            );
          }
          const def = getProject(job.projectId);
          const remainingMs = Math.max(0, job.completesAt - Date.now());
          const totalMs = Math.max(1, job.completesAt - job.startedAt);
          const progressPct = 100 - (remainingMs / totalMs) * 100;
          return (
            <div key={slot.index} className="slot-cell busy">
              <span className="st">SLOT {String(slot.index + 1).padStart(2, "0")} · ACTIVE</span>
              <span className="pname">{def.displayName}</span>
              <span className="timer mono">{formatDuration(remainingMs)} remaining</span>
              {slot.queuedNext && (
                <span className="timer mono" style={{ color: "var(--fg-mute)" }}>
                  ⇒ queued: {getProject(slot.queuedNext.projectId).displayName}{" "}
                  <button
                    className="pill"
                    style={{ height: 18, fontSize: 9 }}
                    onClick={() => onCancelQueued(slot.index)}
                  >
                    cancel
                  </button>
                </span>
              )}
              <div className="bar">
                <div className="fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TierCard({
  def, bay, selected, onSelect,
}: {
  def: { id: ProjectId; displayName: string; description: string; unlocksTier?: number };
  bay: ResearchBayState;
  selected: boolean;
  onSelect: () => void;
}) {
  const owned = isProjectOwned(bay, def.id);
  const inFlight = isProjectInFlight(bay, def.id);
  const tier = def.unlocksTier ?? 0;

  let stateClass = "";
  let badge: { cls: string; text: string };
  if (owned) {
    stateClass = "owned";
    badge = { cls: "tbadge", text: "RESEARCHED" };
  } else if (inFlight) {
    stateClass = "researching";
    badge = { cls: "tbadge", text: "IN PROGRESS" };
  } else {
    badge = { cls: "tbadge", text: "AVAILABLE" };
  }

  const slot = bay.slots.find((s) => s.job?.projectId === def.id);
  const progressPct = slot?.job
    ? Math.min(100, 100 - ((slot.job.completesAt - Date.now()) / (slot.job.completesAt - slot.job.startedAt)) * 100)
    : 0;

  return (
    <div
      className={`tier-card${selected ? " active" : ""} ${stateClass}`}
      onClick={onSelect}
    >
      <div className="tnum mono">{tier > 0 ? String(tier).padStart(2, "0") : "—"}</div>
      <div className="tname">{def.displayName}</div>
      <div className="tdesc">{def.description}</div>
      <div className="tstatus">
        <span className={badge.cls} style={{ padding: "2px 6px", borderRadius: 3 }}>{badge.text}</span>
      </div>
      {inFlight && (
        <div className="tprog">
          <div className="pf" style={{ width: `${progressPct}%` }} />
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  def, bay, selected, onSelect,
}: {
  def: { id: ProjectId; displayName: string; description: string; alloyCost: number; baseDurationMs: number };
  bay: ResearchBayState;
  selected: boolean;
  onSelect: () => void;
}) {
  const inFlight = isProjectInFlight(bay, def.id);
  return (
    <div
      className={`project-row${selected ? " selected" : ""}${inFlight ? " researching" : ""}`}
      onClick={onSelect}
    >
      <div>
        <div className="pn">{def.displayName}</div>
        <div className="pd">{def.description}</div>
        <div className="tag-row">
          <span className="tg">L{bay.levels[def.id] ?? 0}</span>
        </div>
      </div>
      <div className="cost-cell">
        <div className="c">{formatBig(def.alloyCost)} alloy</div>
        <div className="dur mono">{formatDuration(effectiveDurationMs(bay, def as never))}</div>
      </div>
    </div>
  );
}

function AccelerationGauge({
  bay, onSelect,
}: { bay: ResearchBayState; onSelect: () => void }) {
  const level = bay.levels["projectAcceleration"] ?? 0;
  const speed = Math.round((Math.pow(1 + 0.02, level) - 1) * 10000) / 100; // approx %
  return (
    <div className="overclock-line" onClick={onSelect} style={{ cursor: "pointer" }}>
      <span className="mono">L{level}</span>
      <div className="gauge"><div className="f" style={{ width: `${Math.min(100, level)}%` }} /></div>
      <span className="val mono">+{(level * 2).toFixed(0)}% speed</span>
      <span className="nx">{speed >= 0 ? "+" : ""}{speed.toFixed(0)}% net · per-level stacking</span>
    </div>
  );
}

function QueueAfterOptions({
  bay, projectId, onQueueAfter,
}: {
  bay: ResearchBayState;
  projectId: ProjectId;
  onQueueAfter: (slotIndex: number, id: ProjectId) => void;
}) {
  const candidates = bay.slots.filter((s) => s.job && !s.queuedNext);
  if (candidates.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
      {candidates.map((s) => (
        <button
          key={s.index}
          className="pill"
          onClick={() => onQueueAfter(s.index, projectId)}
          style={{ fontSize: 10 }}
        >
          ⇒ Queue after Slot {String(s.index + 1).padStart(2, "0")}
        </button>
      ))}
    </div>
  );
}

function formatBig(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return "instant";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  if (hours > 0) return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
