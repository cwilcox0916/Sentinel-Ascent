# Auto-Procurement Spec

This document defines the **Auto-Procurement** system — the researchable in-run upgrade automation that the user requested. It is part of the MVP at Tier 1; Tiers 2–4 follow Stratum-gated unlocks.

`New` (no source-pack analog; Sentinel Ascent's distinguishing feature beyond renaming the source genre)

## 1. Player-Facing Pitch

> Auto-Procurement automatically spends your Scrip on Forge upgrades during a run, so you can keep your eyes on the battlefield (or look away entirely). Earlier tiers buy whatever is cheapest in a category. Later tiers let you prioritize specific stats, set Scrip reserves, and write conditional rules — for example, "if Sentinel HP drops below 50%, prioritize Defense."

## 2. Goals

- **Optional**: manual play remains satisfying. The build never assumes Auto-Procurement is on.
- **Researchable**: each tier is a Research Bay project, not a one-button unlock. Earning it feels like progression.
- **Deterministic**: Auto-Procurement runs inside the simulation tick at a fixed position, so Weekly Trial replays and mid-run save resumes behave identically with or without it.
- **Transparent**: every automated purchase is visible — a HUD pulse on the relevant tab, a small popup near the upgrade panel, and an entry in the run log.

## 3. Four Tiers

`New`

The tiers are unlocked in order through the Research Bay. Each tier appears as a project node with Alloy + Catalyst cost and a real-time research duration.

| Tier | Project name | Stratum gate | Capability summary |
|---|---|---|---|
| 1 | **Procurement I — Single Channel** | Stratum 2, Cycle 100 | Auto-buy enabled for **one** Forge category (Attack / Defense / Utility — player picks). Buys cheapest available stat in that category whenever Scrip ≥ next-cheapest cost. |
| 2 | **Procurement II — Multi-Channel** | Stratum 4, Cycle 50 | Auto-buy across all **three** categories simultaneously. Per-category on/off toggle. Per-category Scrip reserve floor. |
| 3 | **Procurement III — Targeted** | Stratum 7, Cycle 200 | Per-individual-stat toggles (~37 stats). Priority weight (1–10) per stat. Optional round-robin fairness within priority ties. |
| 4 | **Procurement IV — Adaptive** | Stratum 12, Cycle 100 | Conditional rules engine. Player authors up to **5 active rules** that override the targeted configuration when their conditions match. Examples in section 9. |

Each tier is a strict superset of the previous tier's capabilities. Researching Tier 3 does **not** retire Tier 1's UI — the player can still operate at the simpler level if they prefer.

## 4. Research Cost Model

`New` (initial seed; tune in build pass)

| Tier | Alloy cost | Catalyst cost | Real-time duration | Stratum gate |
|---|---|---|---|---|
| Tier 1 | 25 000 | 0 | 30 minutes | Stratum 2 / Cycle 100 |
| Tier 2 | 250 000 | 0 | 4 hours | Stratum 4 / Cycle 50 |
| Tier 3 | 5 000 000 | 50 | 24 hours | Stratum 7 / Cycle 200 |
| Tier 4 | 100 000 000 | 500 | 7 days | Stratum 12 / Cycle 100 |

Real-time durations follow the Research Bay's normal pacing and are reduced by **Project Acceleration** research and Heirloom multipliers (matching the Research Bay's broader rules — see [04-progression-systems.md](04-progression-systems.md) section 5).

## 5. Where Auto-Procurement Runs Inside The Tick

`New`

Auto-Procurement evaluates **once per simulation tick** at a fixed position:

```
Tick order (from 01-core-runtime-and-combat-spec.md §4):
  1. advanceCycleTimer
  2. spawnCycleUnits
  3. updateEnemies
  4. updateEnemyProjectiles
  5. evaluateAutoProcurement   ← here
  6. updateSentinelAttack
  7. updateSentriesAndCharges
  8. updateArsenals
  9. updateProjectiles
 10. resolveHits
 11. resolveSentinelContact
 12. resolveDeathsAndRewards
 13. updatePopupsAndEffects
 14. checkRunEnd
```

Placing it after enemy update (so health/threat data is current) and before the Sentinel fires (so a same-tick purchase affects the upcoming shot) yields intuitive behavior.

Each tick, evaluation does at most one of:

- Buy one upgrade in one category, OR
- Buy one upgrade per active category (Tier 2+), OR
- Buy according to the priority/rules engine (Tier 3+/4)

Multiple buys in the same tick are allowed if the configuration permits and Scrip remains.

## 6. Tier 1 — Single Channel (Detailed)

`New`

UI: a single panel inside the upgrade screen titled "Auto-Procurement". Three radio buttons: **Attack**, **Defense**, **Utility** — and an **Off** toggle.

Logic:

```ts
function evaluateTier1(run: RunState) {
  const cfg = run.autoProcurement.tier1;
  if (!cfg.enabled) return;
  const tab = forge.tabs[cfg.category];
  const cheapest = pickCheapestPurchasable(tab, run.scrip);
  if (!cheapest) return;
  buyUpgrade(run, cheapest);
  emitAutoBuyPulse(cfg.category, cheapest.statId);
}
```

Cheapest selection: among stats whose next-level cost ≤ current Scrip, pick the one with the lowest cost. Tie-break by stat ID (deterministic).

Edge cases:

- If no stat is purchasable, do nothing (do not save up — this is the player's job at Tier 1)
- If a Free Upgrade utility tick fires and grants a free purchase, Auto-Procurement still considers paying for additional upgrades next tick

## 7. Tier 2 — Multi-Channel (Detailed)

`New`

UI: three on/off toggles (Attack / Defense / Utility), each with a numeric **Scrip Reserve** input.

Logic:

```ts
function evaluateTier2(run: RunState) {
  const cfg = run.autoProcurement.tier2;
  for (const category of ["attack", "defense", "utility"] as const) {
    const sub = cfg[category];
    if (!sub.enabled) continue;
    const available = run.scrip - sub.scripReserve;
    if (available <= 0) continue;
    const tab = forge.tabs[category];
    const cheapest = pickCheapestPurchasable(tab, available);
    if (!cheapest) continue;
    buyUpgrade(run, cheapest);
    emitAutoBuyPulse(category, cheapest.statId);
  }
}
```

The Scrip Reserve floor lets the player keep a buffer for an expected manual purchase. For example: "Reserve 50 000 Scrip for Defense; let Auto-Procurement spend everything else."

## 8. Tier 3 — Targeted (Detailed)

`New`

UI: an expandable list of all in-run upgradable stats (~37). Each row has:

- An on/off toggle
- A numeric priority (1–10)
- The current price for the next level

Logic:

```ts
function evaluateTier3(run: RunState) {
  const cfg = run.autoProcurement.tier3;
  const candidates = forge.allStats
    .filter((s) => cfg.enabled[s.statId])
    .filter((s) => s.nextCost <= run.scrip)
    .sort((a, b) => {
      const pa = cfg.priority[a.statId];
      const pb = cfg.priority[b.statId];
      if (pa !== pb) return pb - pa;                  // higher priority first
      if (cfg.fairnessRoundRobin) {
        return cfg.lastBoughtTick[a.statId] - cfg.lastBoughtTick[b.statId];
      }
      return a.nextCost - b.nextCost;                 // tie-break: cheapest first
    });
  if (candidates.length === 0) return;
  const target = candidates[0];
  buyUpgrade(run, target);
  cfg.lastBoughtTick[target.statId] = run.tickNumber;
  emitAutoBuyPulse(target.category, target.statId);
}
```

Round-robin fairness: when multiple stats share the same priority, the one **least recently bought** is purchased next, so they level evenly.

Saved configurations: the player can save Tier 3 configurations as named **Loadouts** ("Farming", "Pushing Cycles", "Arsenal Cycle Day"). Loadouts are part of the slot's saved state.

## 9. Tier 4 — Adaptive (Detailed)

`New`

A small rules engine. Up to **5 active rules** per Loadout. Rules override Tier 3's targeted configuration when their condition matches.

Rule grammar:

```
RULE := IF <CONDITION> THEN <ACTION>

CONDITION := <SENSOR> <COMPARATOR> <VALUE>
           | <CONDITION> AND <CONDITION>
           | <CONDITION> OR <CONDITION>

SENSOR := sentinel.hpPercent
        | barrier.hpPercent
        | cycle
        | cycle.isBoss
        | cycle.isFleet
        | scrip
        | enemiesAlive
        | enemiesAlive.kind=<archetype>
        | runDurationSeconds

COMPARATOR := < | <= | > | >= | == | !=

VALUE := <number> | <percent> | <bool>

ACTION := SET_PRIORITY <statId> <number>
        | DISABLE_CATEGORY <category>
        | ENABLE_CATEGORY <category>
        | PAUSE_AUTO_BUY
        | ONLY_BUY <statId>...
```

Worked examples (these are the canned templates the build ships with so players don't start from a blank UI):

| Rule name | Definition |
|---|---|
| **Defensive Stand** | `IF sentinel.hpPercent < 50 THEN ONLY_BUY health, defensePercent, healthRegen` |
| **Boss Cycle Focus** | `IF cycle.isBoss THEN DISABLE_CATEGORY utility AND SET_PRIORITY damage 10` |
| **Fleet Lockdown** | `IF cycle.isFleet THEN ONLY_BUY damage, attackSpeed, critFactor` |
| **Save For Wall** | `IF barrier.hpPercent < 25 THEN PAUSE_AUTO_BUY` |
| **Late-Run Economy Tilt** | `IF runDurationSeconds > 1200 THEN SET_PRIORITY scripBonus 10 AND SET_PRIORITY interestPerCycle 9` |

Rule evaluation:

- Rules evaluate in order; the first matching rule wins (or the player can opt into "all matching rules apply" mode, which composes ACTIONs).
- An `ONLY_BUY` action restricts the candidate pool for the tick to the listed stats.
- A `PAUSE_AUTO_BUY` action skips the purchase step entirely for the tick — useful for saving up.
- A `SET_PRIORITY` action overrides the Tier 3 priority for the tick only; the player's saved priorities are not mutated.

Authoring UI: a row-per-rule visual editor. The player picks sensors, comparators, values, and actions from dropdowns. The grammar exists for clarity but the player never types it directly. Rules are stored as structured JSON in the slot.

## 10. HUD Feedback

`New` (visual specifics locked in [10-design-system.md](10-design-system.md) sections 4 and 8)

- The Forge `.tab` headers (Attack / Defense / Utility) show a pulsing prism `.auto-glow` dot top-right while Auto-Procurement is active in that category
- Each automated purchase fires the `autobuy` keyframe on the bought `.up-row` (1-shot prism flash, 0.6 s)
- Auto-targeted stats carry a small prism `.auto-pin` dot top-right of the row
- A small green **toast** appears in the toast stack (`.toast.auto`) per automated purchase
- The `.ap-panel` channel cards (`.ap-chan`) switch their border to `--prism` when active and increment a per-channel buy counter
- The `.ap-panel` foot row shows `RULES · N/5` and the current research timer for the next tier (e.g. `TIER 3 · RESEARCHING 14:22:08`)
- A **mute auto-buy sound** option exists in settings (default: on, very quiet click)
- A **disable HUD pulses** option exists for players who want a calmer screen
- The Research Bay tier ladder card for the current Auto-Procurement tier plays the `tierComplete` keyframe (1.2 s prism inset/outset glow) on completion; if the Bay is closed, the rail's Research button gets the `complete-pulse` class with a green dot indicator until the player opens it

## 11. Configuration Persistence

`New`

Auto-Procurement state lives in the slot and persists across runs:

```ts
type AutoProcurementSlotState = {
  unlockedTiers: 1 | 2 | 3 | 4;     // highest researched
  activeTier: 1 | 2 | 3 | 4;        // player can downshift to a simpler tier
  tier1?: Tier1Config;
  tier2?: Tier2Config;
  tier3?: Tier3Config;
  tier4?: { rules: RuleDef[]; mode: "first-match" | "all-match" };
  loadouts: Record<string, Tier3PlusLoadout>;
  activeLoadout: string | null;
};

type AutoProcurementRuntimeState = {
  enabled: boolean;
  lastBoughtTick: Record<string, number>;  // for round-robin fairness
  pulseQueue: AutoBuyPulse[];              // drained by the render layer each frame
};
```

## 12. Defaults

`New` (sensible starting state at each tier unlock)

- Tier 1 unlock: defaults to **Defense** category (most failure-causing for new players)
- Tier 2 unlock: all three categories enabled, Scrip Reserve = 0
- Tier 3 unlock: every stat enabled at priority 5, round-robin fairness on
- Tier 4 unlock: zero rules; presets list in the rule library

## 13. Interaction With Other Systems

`New`

- **Boons**: a Boon that grants "+50% Scrip" causes Auto-Procurement to buy more frequently. No special handling needed.
- **Free Upgrades** (utility stat): a free upgrade is granted by the sim independently. Auto-Procurement does not interact with free upgrades.
- **Cycle Skip**: Auto-Procurement does not initiate a Cycle Skip even if Cycle Skip is researched. Cycle Skip is always a manual action.
- **Pause**: when the game is paused, Auto-Procurement pauses (the sim is paused; Auto-Procurement evaluates inside `simulateTick`).
- **Resilience Surge**: a Tier 4 rule like `IF sentinel.hpPercent < 5 THEN ONLY_BUY healthRegen` synergizes with Resilience Surge — survive the surge, then auto-recover.

## 14. Test Coverage

`New`

Required Vitest coverage:

- Tier 1 deterministic: same RunState input → identical purchase decision
- Tier 2 reserve floor: a 50 k reserve never spends below 50 k
- Tier 3 priority ordering: priority 10 always wins over priority 5
- Tier 3 round-robin: two stats at equal priority alternate exactly
- Tier 4 rule precedence: first-matching rule selected when in "first-match" mode
- Tier 4 ONLY_BUY: candidate pool restricted to listed stats and nothing else
- Snapshot/resume parity: a snapshot taken with Auto-Procurement active resumes with byte-identical Auto-Procurement runtime state

## 15. Open Questions For The Build Team

- Whether Tier 4 rules should support arithmetic on values (e.g., `cycle * 100`) — recommend: no, keep grammar simple
- Whether to expose a "simulate this configuration" tool that runs an offline 1000-tick projection — useful for tweakers, low cost since the sim is deterministic
- Whether the rule editor should support drag-and-drop reorder for rule precedence — recommend: yes
- How to teach Tier 4: the user-experience case for guided onboarding the first time the player opens the rule editor
