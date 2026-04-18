# Enemies And Cycle Spec

This document is the content and behavior spec for enemy-side systems in `Sentinel Ascent`. It mirrors the source pack's structure section-for-section, with all 12 archetypes renamed.

## 1. Enemy Categories

`Verified` (genre structure)

Four bands:

- **Normal** — basic combat fodder
- **Behemoth** — periodic boss
- **Elite** — counter-build pressure
- **Fleet** — late-game, immunity-laden, unique mechanics

Spawn caps at one moment:

- Normals: 120
- Elites: 20
- Behemoths: 10
- Fleet enemies occupy slots in the normal cap (see section 14)

## 2. Shared Enemy Behaviors

`Verified` + `Inferred`

All enemies generally:

- Spawn outside the Sentinel
- Move inward toward the center, or stop and attack from range
- Have HP, movement speed, and an attack profile
- Reward Alloy (and possibly Catalyst, Augment Fragments, Flux Crystals, or Insignia) on death
- Scale with Cycle and Stratum

## 3. Normal Enemies (4)

`Verified` (renamed)

| Source | Sentinel Ascent name | Identity |
|---|---|---|
| Basic | **Drone** | Baseline; average HP, average speed, average reward; the bulk of every Cycle |
| Fast | **Skimmer** | Low HP, high speed; threatens leaks past defenses |
| Tank | **Hulk** | Slow, high HP; attrition pressure |
| Lancer | **Lancer** *(kept as a rename — neutral term)* | Stops outside the Sentinel and attacks from range |

> Naming note: "Lancer" is an original-language term used here for the ranged archetype to align with the sci-fi theme; it does not collide with any source-pack proper noun.

## 4. Behemoths (Bosses)

`Verified` (boss role; renamed)

Behemoths are periodic high-HP enemies that lock Protocol swapping while alive.

Rules:

- Spawn every Behemoth interval Cycle (default every 10 Cycles; tightens at higher Strata)
- HP is many multiples of common-enemy HP at the same Cycle
- Must be killed by regular damage systems — the **Annihilator Beam cannot kill a Behemoth**
- Their presence forces a temporary tactical shift (toggle Resonance Surge off, prioritize raw DPS Arsenals, etc.)

While a Behemoth — or any fleet enemy — is alive, the Protocols panel locks and equipped Protocols cannot be changed.

## 5. Elite Enemies (4)

`Verified` (renamed)

Elites are designed to counter over-optimized standard farming setups. The four:

- **Aegis** (was Protector)
- **Leech** (was Vampire)
- **Splitter** (was Scatter)
- **Lance** (was Ray) — distinct from the Lancer normal enemy by silhouette and colour palette

## 6. Aegis

`Verified` (renamed)

Key rule:

- **Enemies inside an Aegis aura cannot be killed by the Annihilator Beam**

Behavior:

- Aegis projects a circular protective aura around itself
- The aura visually telegraphs as a thin, pulsing ring
- Aegis itself is killable by normal projectile fire and other systems — only the Annihilator Beam is blocked

## 7. Leech

`Verified` (renamed; numbers preserved from source)

Behavior:

- HP: `2x` that of a Drone at the same Cycle
- Drains `2%` of Sentinel max Health per second while channeling
- **Disables Health Regen and Lifesteal while channeling** (Barrier Rebuild is **not** disabled)
- Base Alloy reward: 4

Important nuance:

- Leech damage is not affected by enemy attack modifiers (Overseer aura, lab buffs, etc.)

Implementation:

- When Leech enters its attack state, draw a thin red beam from Leech to Sentinel core
- Apply the percent-max-Health drain per tick
- Suppress Health Regen and Lifesteal flags while the beam is active
- Re-enable them the frame after the beam ends

## 8. Splitter

`Verified` (renamed); `Inferred` (mechanic detail)

Splitter exists as an elite type but full mechanics were not fully exposed in the source pack. For Sentinel Ascent, implement Splitter as:

- An elite that fractures pressure across space
- On death, **splits into 3–5 child threats** that inherit a fraction of the parent's HP and damage
- Designed to punish heavy single-target focus (a high-DPS one-shot kill creates the worst fragment cloud)

Suggested telegraph: Splitter has a faintly fractured outline; killing it triggers a brief flash before the children separate.

## 9. Lance

`Verified` (renamed); `Inferred` (mechanic detail)

Lance is a line-attack elite:

- Stops outside the Sentinel's normal contact range
- Telegraphs a beam aimed at the Sentinel core
- Fires a high-damage line attack on a fixed cooldown
- Designed to punish defenses that only solve contact damage

The beam can be interrupted by killing Lance during the wind-up (telegraphed visually with a charging glow).

## 10. Fleet Enemies (3)

`Verified` (renamed)

Fleet roster:

- **Disruptor** (was Saboteur)
- **Overseer** (was Commander)
- **Resonant** (was Overcharge)

### Shared fleet rules

- Encountered from **Stratum 14** onward (default; see section 16 for the schedule)
- Immune to Sentries
- Immune to the Annihilator Beam
- Immune to Pulse
- Immune to Repulse
- Immune to Singularity damage and pull
- 90% resistance to Thorns
- 50% resistance to Stasis Field, Stasis Loop, Thunder Construct, Corrosive Bloom stun, Charges stun, Proximity Charges stun
- The **Magnetic Hook** Augment and the **Plasma Lance** Protocol cannot target fleet enemies
- Do not collide with other enemies

### Positioning

- **Overseer** and **Resonant** operate from **outside** the Sentinel's normal range
- **Disruptor** fully approaches the Sentinel

## 11. Disruptor

`Verified` (numbers preserved from source)

- Speed: `2x`
- HP: `20x` Drone HP at the same Cycle
- On impact with the Sentinel: **disables a random Arsenal**
- The disabled Arsenal is **re-enabled when the Disruptor dies**
- The Barrier can absorb the Disruptor's impact and prevent the debuff
- Still counts as attacking for Thorns
- Does **not** trigger Energy Shield (a tier-3 Protocol)
- Does **not** break the Barrier on impact
- Pairs with Skimmers in its spawn group

## 12. Overseer

`Verified` (numbers preserved)

- Speed: `0.5x`
- HP: `20x`
- Empowers nearby enemies in a visible aura
- Aura buff: `2x` enemy HP while inside the aura
- Pairs with Hulks in its spawn group

Implementation:

- Emit a soft red aura ring around the Overseer
- Multiply HP for any enemy whose centre lies inside the aura
- HP returns to baseline if an enemy leaves the aura

## 13. Resonant

`Verified` (numbers preserved)

- Speed: `1x`
- HP: `20x`
- Fires a returning projectile at the Sentinel
- The projectile **deals double damage with each subsequent hit** (compound danger if allowed to keep cycling)
- Pairs with Lancers in its spawn group

Treat Resonant as a ranged fleet sniper. The projectile is large, slow, and visually distinct (a glowing ring).

## 14. Fleet Spawning

`Verified`

- Fleet enemies always spawn when scheduled
- Cycle Skip on a fleet Cycle still spawns the fleet group
- Fleet spawn time within the Cycle is randomized
- Each fleet enemy spawns alongside a **paired group** of related normal enemies (10–14 by default)
- If the normal-enemy spawn cap is full, a paired enemy despawns to make room for the fleet enemy
- Pairings:
  - Disruptor ↔ Skimmers
  - Overseer ↔ Hulks
  - Resonant ↔ Lancers

## 15. Fleet Rewards

`Verified` (drop chances preserved; absolute numbers scale with Stratum)

- 80% chance to drop **Flux Crystals** (reroll currency for Augments)
- 20% chance to drop **Augment Fragments** (rank-up currency for Augments)

At Stratum 14 the documented reward table starts at:

- Flux Crystals: 1080 per drop
- Augment Fragments: 5 per drop

Higher Strata scale these upward.

## 16. Fleet Schedule Across Strata

`Verified` (formula preserved)

- **Stratum 1**: first fleet Cycle is **15 000**
- Each higher Stratum moves the first fleet Cycle **250 Cycles earlier**
- Once fleet appearances begin in a run, fleet enemies appear **every 100 Cycles**

## 17. Enemy Scaling

`Verified` + `Inferred`

Enemy stats scale with both Cycle and Stratum. Research Bay projects further modify HP/damage by enemy type, so base ratios diverge in late progression.

Recommended pipeline:

1. Pull base archetype multipliers
2. Multiply by the Stratum scaling curve
3. Multiply by the Cycle scaling curve
4. Apply elite / Behemoth / fleet overrides
5. Apply Research Bay / Boon / Heirloom modifiers last

## 18. Battle Conditions And Heat

`Verified` + `Inferred` (genre feature)

Higher Strata include condition-style modifiers that change a run's pressure profile:

- Enemy buffs (e.g., +50% Hulk HP)
- Sentinel nerfs (e.g., −25% Lifesteal)
- Special Cycle rules (e.g., "no Behemoth this Cycle, but two Splitters spawn")
- Build-forcing mutators (e.g., "Annihilator Beam disabled this run")

Conditions are surfaced to the player at run-select with a clear text and icon stack.

## 19. Recommended Enemy Data Format

`Inferred`

```ts
type EnemyArchetype =
  | "drone"
  | "skimmer"
  | "hulk"
  | "lancer"
  | "behemoth"
  | "aegis"
  | "leech"
  | "splitter"
  | "lance"
  | "disruptor"
  | "overseer"
  | "resonant";

type EnemyDefinition = {
  archetype: EnemyArchetype;
  baseHp: number;
  baseSpeed: number;
  baseDamage: number;
  baseAlloyReward: number;
  radius: number;
  immunities: Immunity[];
  resistances: Partial<Record<EffectKind, number>>;
  spawnGroupCap?: number;
  pairsWith?: EnemyArchetype;
};
```

## 20. Quality Checklist

A clone is in the right zone if:

- Drones create steady farm pressure
- Skimmers leak more often than Hulks
- Lancers force investment into ranged answers
- Behemoths produce real Protocol-lock tension
- Aegis visibly invalidates the Annihilator Beam around its aura
- Leech interrupts sustain builds and sustain players notice immediately
- Splitter punishes heavy single-target builds with a fragment cloud
- Lance punishes contact-only defenses with a telegraphed line
- Fleet enemies force direct-damage answers; passive automation alone fails

## 21. Open Questions For The Build Team

- Final Splitter child count and inherited-stat percentages
- Lance damage relative to a Cycle's expected DPS budget
- Whether Cycle-Skip on fleet Cycles still triggers the full pair group or only the fleet enemy
- Final fleet schedule for Strata 1–13 (currently fleets only appear from Stratum 14 by default; consider a softer onboarding ramp)
