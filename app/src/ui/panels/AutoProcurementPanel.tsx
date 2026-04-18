import { useState } from "react";
import { useRunStore } from "../../store/runStore.ts";
import {
  getUpgrade,
  listUpgrades,
  type UpgradeCategory,
  type UpgradeId,
} from "../../meta/forge.ts";
import { RULE_TEMPLATES, type Rule } from "../../sim/autoProcurement.ts";

/**
 * Auto-Procurement subpanel — routes by `activeTier`.
 *
 * Locked structure per docs/my_game/10-design-system.md §4 (.ap-panel).
 * Spec: docs/my_game/08-auto-procurement-spec.md §§6–9.
 *
 *   activeTier 1 → master toggle + 3 single-select channel cards (Phase 4)
 *   activeTier 2 → per-channel toggle + reserve floor (Phase 6)
 *   activeTier 3 → per-stat list with priority sliders + fairness (Phase 9)
 *   activeTier 4 → rule library + active rules list (Phase 9)
 */
export function AutoProcurementPanel() {
  const ap = useRunStore((s) => s.autoProcurement);
  const unlocked = ap.unlockedTier;
  const active = ap.activeTier;
  const setActiveTier = useRunStore((s) => s.actions?.setActiveTier);

  return (
    <div className="ap-panel">
      <div className="ap-head">
        <h4>
          Auto-Procurement{" "}
          <span className="ap-tier mono">
            TIER {active || "—"}
            {unlocked > 0 && unlocked > 1 && (
              <span className="ap-tier-switch">
                {[1, 2, 3, 4].map((t) => {
                  const u = t <= unlocked;
                  const a = t === active;
                  return (
                    <button
                      key={t}
                      className={`ap-tier-pill${a ? " active" : ""}${u ? "" : " locked"}`}
                      disabled={!u}
                      onClick={() => u && setActiveTier?.(t as 1 | 2 | 3 | 4)}
                      title={u ? `Switch to Tier ${t}` : `Tier ${t} locked — research to unlock`}
                    >
                      {t}
                    </button>
                  );
                })}
              </span>
            )}
          </span>
        </h4>
      </div>

      {active === 0 && <ApLockedHint />}
      {active === 1 && <Tier1View />}
      {active === 2 && <Tier2View />}
      {active === 3 && <Tier3View />}
      {active === 4 && <Tier4View />}

      <div className="ap-foot">
        <span>
          RULES · {ap.tier4.rules.filter((r) => r.enabled).length} / 5
        </span>
        <span>
          {unlocked >= 4
            ? "TIER 4 · UNLOCKED"
            : `TIER ${unlocked + 1} · LOCKED · RESEARCH BAY`}
        </span>
      </div>
    </div>
  );
}

/* =============== Tier 0 hint =============== */

function ApLockedHint() {
  return (
    <div className="ap-locked-hint mono">
      Auto-Procurement locked — research Tier 1 in the Research Bay to unlock.
    </div>
  );
}

/* =============== Tier 1: single channel =============== */

function Tier1View() {
  const ap = useRunStore((s) => s.autoProcurement);
  const setCategory = useRunStore((s) => s.actions?.setAutoProcurementCategory);
  const setEnabled = useRunStore((s) => s.actions?.setAutoProcurementEnabled);

  return (
    <>
      <div className="ap-master">
        <div
          className={`ap-toggle${ap.tier1Enabled ? " on" : ""}`}
          onClick={() => setEnabled?.(!ap.tier1Enabled)}
          title={ap.tier1Enabled ? "Disable" : "Enable"}
        />
        <span className="ap-master-lbl mono">
          {ap.tier1Enabled ? "AUTO ACTIVE" : "AUTO OFF"}
        </span>
      </div>
      <div className="ap-channels">
        {(["attack", "defense", "utility"] as const).map((cat) => (
          <div
            key={cat}
            className={`ap-chan${ap.tier1Enabled && ap.tier1Category === cat ? " active" : ""}`}
            onClick={() => setCategory?.(cat)}
          >
            <div className="nm">{cat}</div>
            <div className="stat">
              <span>{ap.tier1Enabled && ap.tier1Category === cat ? "ON" : "off"}</span>
              <span className="count" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* =============== Tier 2: multi-channel =============== */

function Tier2View() {
  const channels = useRunStore((s) => s.autoProcurement.tier2Channels);
  const setEnabled = useRunStore((s) => s.actions?.setTier2ChannelEnabled);
  const setReserve = useRunStore((s) => s.actions?.setTier2ChannelReserve);
  return (
    <div className="ap-t2">
      {(["attack", "defense", "utility"] as const).map((cat) => {
        const c = channels[cat];
        return (
          <div key={cat} className={`ap-t2-row${c.enabled ? " on" : ""}`}>
            <div
              className={`ap-toggle${c.enabled ? " on" : ""}`}
              onClick={() => setEnabled?.(cat, !c.enabled)}
            />
            <div className="nm">{cat}</div>
            <div className="ap-t2-reserve">
              <span className="lbl mono">RESERVE</span>
              <input
                type="number"
                min={0}
                step={50}
                value={c.reserve}
                onChange={(e) => setReserve?.(cat, Number(e.target.value) || 0)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =============== Tier 3: per-stat =============== */

function Tier3View() {
  const t3 = useRunStore((s) => s.autoProcurement.tier3);
  const setStatEnabled = useRunStore((s) => s.actions?.setTier3StatEnabled);
  const setStatPriority = useRunStore((s) => s.actions?.setTier3StatPriority);
  const setFairness = useRunStore((s) => s.actions?.setTier3Fairness);

  const byCategory: Record<UpgradeCategory, UpgradeId[]> = {
    attack: [],
    defense: [],
    utility: [],
  };
  for (const u of listUpgrades()) byCategory[u.category].push(u.id);

  return (
    <div className="ap-t3">
      <div className="ap-t3-controls">
        <label className="ap-t3-fair">
          <input
            type="checkbox"
            checked={t3.fairnessRoundRobin}
            onChange={(e) => setFairness?.(e.target.checked)}
          />
          <span className="mono">ROUND-ROBIN FAIRNESS</span>
        </label>
      </div>
      {(["attack", "defense", "utility"] as const).map((cat) => (
        <div key={cat} className="ap-t3-cat">
          <div className="ap-t3-cat-head mono">{cat}</div>
          {byCategory[cat].map((id) => {
            const def = getUpgrade(id);
            return (
              <div key={id} className={`ap-t3-row${t3.enabled[id] ? " on" : " off"}`}>
                <input
                  type="checkbox"
                  checked={!!t3.enabled[id]}
                  onChange={(e) => setStatEnabled?.(id, e.target.checked)}
                />
                <span className="nm">{def.name}</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={t3.priority[id] ?? 5}
                  onChange={(e) => setStatPriority?.(id, Number(e.target.value))}
                  disabled={!t3.enabled[id]}
                />
                <span className="ap-t3-prio mono">P{t3.priority[id] ?? 5}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* =============== Tier 4: rules engine =============== */

function Tier4View() {
  const t4 = useRunStore((s) => s.autoProcurement.tier4);
  const addRule = useRunStore((s) => s.actions?.addTier4Rule);
  const removeRule = useRunStore((s) => s.actions?.removeTier4Rule);
  const toggleRule = useRunStore((s) => s.actions?.toggleTier4Rule);
  const setMode = useRunStore((s) => s.actions?.setTier4Mode);
  const [picker, setPicker] = useState(false);
  const usedNames = new Set(t4.rules.map((r) => r.name));
  const available = RULE_TEMPLATES.filter((t) => !usedNames.has(t.name));

  return (
    <div className="ap-t4">
      <div className="ap-t4-head">
        <div className="ap-t4-mode mono">
          <label>
            <input
              type="radio"
              name="t4-mode"
              checked={t4.mode === "first-match"}
              onChange={() => setMode?.("first-match")}
            />
            FIRST-MATCH
          </label>
          <label>
            <input
              type="radio"
              name="t4-mode"
              checked={t4.mode === "all-match"}
              onChange={() => setMode?.("all-match")}
            />
            ALL-MATCH
          </label>
        </div>
        <button
          className="ap-t4-add"
          onClick={() => setPicker((x) => !x)}
          disabled={t4.rules.length >= 5 || available.length === 0}
          title={t4.rules.length >= 5 ? "5-rule cap reached" : "Add rule from library"}
        >
          {picker ? "× CLOSE" : "+ ADD RULE"}
        </button>
      </div>

      {picker && (
        <div className="ap-t4-picker">
          {available.length === 0 ? (
            <div className="ap-t4-empty mono">All templates added.</div>
          ) : (
            available.map((tpl) => (
              <button
                key={tpl.name}
                className="ap-t4-tpl"
                onClick={() => {
                  addRule?.(tpl.name);
                  setPicker(false);
                }}
              >
                <div className="ap-t4-tpl-name">{tpl.name}</div>
                <div className="ap-t4-tpl-desc mono">{describeRuleTemplate(tpl)}</div>
              </button>
            ))
          )}
        </div>
      )}

      {t4.rules.length === 0 && !picker && (
        <div className="ap-t4-empty mono">
          No rules active. Add a rule from the library to override Tier 3 priorities.
        </div>
      )}

      {t4.rules.map((rule) => (
        <div key={rule.id} className={`ap-t4-rule${rule.enabled ? " on" : ""}`}>
          <div
            className={`ap-toggle${rule.enabled ? " on" : ""}`}
            onClick={() => toggleRule?.(rule.id, !rule.enabled)}
          />
          <div className="ap-t4-rule-body">
            <div className="ap-t4-rule-name">{rule.name}</div>
            <div className="ap-t4-rule-def mono">{describeRule(rule)}</div>
          </div>
          <button className="ap-t4-del" onClick={() => removeRule?.(rule.id)} title="Remove">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function describeRule(rule: Rule): string {
  const cond = `${rule.condition.sensor} ${rule.condition.comparator} ${rule.condition.value}`;
  const acts = rule.actions.map(describeAction).join(" & ");
  return `IF ${cond} THEN ${acts}`;
}

function describeRuleTemplate(tpl: { condition: Rule["condition"]; actions: Rule["actions"] }): string {
  const cond = `${tpl.condition.sensor} ${tpl.condition.comparator} ${tpl.condition.value}`;
  const acts = tpl.actions.map(describeAction).join(" & ");
  return `IF ${cond} THEN ${acts}`;
}

function describeAction(a: Rule["actions"][number]): string {
  switch (a.kind) {
    case "PAUSE_AUTO_BUY":
      return "PAUSE";
    case "SET_PRIORITY":
      return `PRIO ${a.statId}=${a.priority}`;
    case "DISABLE_CATEGORY":
      return `DISABLE ${a.category}`;
    case "ENABLE_CATEGORY":
      return `ENABLE ${a.category}`;
    case "ONLY_BUY":
      return `ONLY ${a.statIds.join(",")}`;
  }
}
