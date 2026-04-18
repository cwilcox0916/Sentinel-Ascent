# Core Runtime And Combat Spec

This document is the implementation-facing combat spec for `Sentinel Ascent`.

## 1. Core Session Loop

`Verified` (genre structure inherited from source pack)

A run is an endless or near-endless **Cycle climb**:

1. Player selects a **Stratum** (difficulty band) from the Hangar screen
2. The run starts; **Cycles** begin spawning enemies on the **Grid**
3. The Sentinel auto-fires; the player earns **Scrip** from kills and Cycle bonuses
4. The player spends Scrip on Forge category upgrades during combat (or lets Auto-Procurement spend it)
5. The player earns persistent currencies (**Alloy**, **Prisms**, **Catalyst**, **Augment Fragments**, **Flux Crystals**, plus mode-specific rewards)
6. The Sentinel falls or the player ends the run via the Hangar pause menu
7. Persistent rewards are banked; Scrip is discarded
8. Outside the run, the player invests permanent currencies into the meta-progression systems

Currency rules (mirrors source genre, names changed):

- **Scrip resets** at run end
- **Alloy, Prisms, Catalyst, Cores, Insignia, Cipher Keys, Subnodes, Order Marks, Augment Fragments, Flux Crystals** — all persist across runs and across save sessions

## 2. Battlefield Geometry

`Observed` + `Inferred`

The Grid is a 2D circular arena with the Sentinel locked at world origin.

- World origin `(0, 0)` is the center of the Sentinel
- Enemies spawn on or beyond the **outer spawn ring** (radius is Stratum-dependent)
- The Sentinel's **range** defines a circular engagement zone
- Some effects (Sentries, Marker Beacon) rotate around the center
- Some effects (Pulse, Annihilation Pulse) expand outward as growing circles

### Coordinate model

```ts
type Vec2 = { x: number; y: number };

type Enemy = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  type: EnemyArchetype;
  state: EnemyState;
  spawnedAtCycle: number;
};
```

The world is rendered through a camera that simply centers on `(0, 0)` and applies a uniform scale; there is no panning. Tablets in portrait orientation use the same world coordinates with a different viewport zoom.

## 3. Render Layers

`Inferred`

The Grid is a single PixiJS `Container` per layer, drawn back to front. DOM/HTML overlays sit above the renderer for HUD panels.

| Layer | Contents |
|---|---|
| 0 | Background gradient and Grid hex pattern |
| 1 | Range circles, spawn ring, Boon zone indicators |
| 2 | Persistent fields: Singularity, Corrosive Bloom, Stasis Field, Marker Beacon cones |
| 3 | Enemy bodies and enemy projectiles |
| 4 | Sentinel core, Barrier ring, Sentries, Charges |
| 5 | Sentinel projectiles, Seeker Salvo missiles, Arc Cascade arcs, Annihilator Beam |
| 6 | Floating Prism pickups, damage numbers, Alloy/Prism popups |
| 7 | DOM HUD overlays and upgrade panels |

## 4. Simulation Update Order

`Inferred`

The sim runs at a fixed 60 Hz tick. Render runs at the display refresh rate using interpolation between the last two ticks.

Recommended order per tick:

1. Advance the Cycle clock and spawn enemies if the Cycle budget allows
2. Update enemy AI and movement intent
3. Apply control fields (Stasis Field slow, Singularity pull, etc.)
4. Move enemy projectiles
5. **Auto-Procurement evaluation step** — if any Auto-Procurement tier is researched and active, evaluate it now (deterministic position, see [08-auto-procurement-spec.md](08-auto-procurement-spec.md))
6. Update Sentinel attack timer; fire projectiles
7. Update Sentries, Charges, Annihilator Beam, and other persistent Sentinel effects
8. Update Arsenals (cooldowns, active windows)
9. Resolve projectile hits and area damage
10. Resolve contact damage, Thorns, Barrier interaction, Lifesteal
11. Process deaths, rewards, death-trigger effects, Prism roll
12. Update VFX/HUD popups
13. Check loss conditions and end-of-run triggers

Determinism: every RNG draw uses the run's seeded PRNG (xoroshiro128+, seeded by `runSeed`). This makes mid-run save snapshots resumable and Weekly Trial scores reproducible.

## 5. Sentinel Combat Identity

`Verified` (genre)

The Sentinel is an auto-firing center weapon platform. The player never aims manually.

Combat pillars:

- Constant projectile fire
- Scaling Damage and Attack Speed
- Range-based control of engagement distance
- Defensive survival systems matter as much as raw DPS
- Multiple parallel kill channels beyond basic projectiles

## 6. Core Sentinel Stats

`Verified` (full parity with source pack)

### Attack-side (12 stats)

| Stat | Effect |
|---|---|
| Damage | Base projectile damage |
| Attack Speed | Shots per second |
| Range | Maximum engagement radius |
| Critical Chance | % chance for critical hit |
| Critical Factor | Multiplier on critical hits |
| Super Crit Chance | % chance to elevate a crit to super crit |
| Super Crit Multiplier | Multiplier on super crits |
| Multishot | Extra projectiles per attack cycle |
| Rapid Fire | Periodic Attack Speed surge |
| Bounce Shot | Projectiles retarget after hit |
| Damage/Meter | Bonus damage scaling with target's distance from center |
| Rend / Rend Max | Stacking bleed-style damage with a per-target ceiling |

### Defense-side (15 stats)

| Stat | Effect |
|---|---|
| Health | Sentinel HP pool |
| Health Regen | Per-second healing |
| Defense % | % reduction on incoming damage |
| Defense Absolute | Flat reduction on incoming damage |
| Thorns | Damage dealt back when struck in contact |
| Lifesteal | Heal as % of damage dealt |
| Repulse Chance | % chance to push enemies away on hit |
| Repulse Force | Distance of the push |
| Pulse Size | Radius of periodic Pulse shockwave |
| Pulse Frequency | Pulses per second |
| Sentries | Number of orbiting Sentries |
| Sentry Speed | Orbital velocity |
| Charge Chance | % chance to deploy a Charge on enemy approach |
| Charge Damage | Charge detonation damage |
| Charge Radius | Charge detonation area |
| Resilience Surge | % chance to survive an otherwise lethal blow |
| Barrier Health | Pre-Sentinel ring HP |
| Barrier Rebuild | Per-second Barrier regeneration |

### Utility-side (10 stats)

| Stat | Effect |
|---|---|
| Scrip Bonus | % multiplier on Scrip earned |
| Scrip/Cycle | Flat Scrip per Cycle completed |
| Alloy Bonus | % multiplier on Alloy earned |
| Alloy/Kill Bonus | Flat Alloy per kill |
| Catalyst/Kill Bonus | Flat Catalyst per kill (caps per Cycle) |
| Interest/Cycle | Scrip earned as a % of held Scrip per Cycle |
| Free Attack Upgrade | Periodic free Attack-tab purchase |
| Free Defense Upgrade | Periodic free Defense-tab purchase |
| Free Utility Upgrade | Periodic free Utility-tab purchase |
| Repair Kits | Consumable healing items dropping from kills |
| Cycle Skip | Advance Cycle counter without fighting |

> Total: ~37 in-run upgradeable stats. The Auto-Procurement Tier 3 grants per-stat toggles for all of them.

## 7. Sentinel Firing Model

`Inferred`

```ts
function updateSentinelAttack(dt: number) {
  sentinel.attackCooldown -= dt;
  if (sentinel.attackCooldown > 0) return;

  const targets = acquireTargets(enemies, sentinel);
  for (const target of targets) {
    spawnProjectile(makeSentinelProjectile(target));
  }
  sentinel.attackCooldown = 1 / sentinel.attacksPerSecond;
}
```

Targeting rules:

- Acquire all enemies within `range`
- Default priority: nearest-to-center, then highest-threat (Behemoths and fleet score above normals)
- Multishot picks N distinct targets; if fewer than N exist, remainders go to the highest-priority target
- Bounce Shot: on hit, search for nearest unhit enemy within bounce radius; bounces are capped per projectile

## 8. Damage Resolution

`Verified` (formula structure)

Per hit, in this order:

1. Start with base damage
2. Apply multiplicative local effects (Marker Beacon vulnerability, Damage/Meter)
3. Roll Critical; on crit, apply Critical Factor
4. If crit, roll Super Crit; on super crit, apply Super Crit Multiplier
5. Apply Rend stack add (Rend stacks tick separately and respect Rend Max)
6. Apply enemy-specific resistance/immunity (Fleet resistances; Aegis-zoned enemies on certain effects)
7. Apply target Defense % then Defense Absolute
8. Clamp to a minimum of 1 damage on hits that would round to 0

## 9. Defensive Survival Model

`Verified` (stacked-systems philosophy)

The Sentinel survives via overlapping systems, not pure HP:

- Raw Health pool
- Defense %
- Defense Absolute
- Health Regen
- Lifesteal
- Repair Kits (consumed on damage)
- Resilience Surge (limited triggers per Cycle)
- Barrier (pre-HP ring with own pool)
- Thorns (passive return damage)
- Crowd control (Repulse, Stasis Field, Singularity) reducing contact frequency

Incoming-hit order:

1. Hit reaches Barrier, then Sentinel core
2. If Barrier > 0, Barrier absorbs first
3. Remaining damage goes through Defense % then Defense Absolute
4. Health is reduced
5. Thorns and contact effects fire
6. If the resulting Health would drop to 0 or below, **Resilience Surge** is checked; if it triggers, Health is restored to a small percentage and the surge counter decrements

## 10. Special Kill Systems

`Verified` (parallel kill channels are core to the genre)

These run **in parallel** with normal projectile fire:

- **Sentries** orbit the Sentinel and damage on contact
- **Pulse** is a periodic outward shockwave
- **Charges** are proximity mines deployed near approaching enemies
- **Annihilator Beam** sweeps the Grid, killing valid enemies it touches
- **Arsenals** add scheduled, large-scale effects (see section 11)

### Annihilator Beam rules

- Kills any normal or elite enemy it touches
- **Cannot kill Behemoths**
- **Cannot kill enemies within an Aegis aura**
- Does not damage fleet enemies (see [02-enemies-and-wave-spec.md](02-enemies-and-wave-spec.md))

### Fleet immunities

Fleet enemies (Disruptor, Overseer, Resonant) are immune to Sentries, the Annihilator Beam, Pulse, Repulse, and Singularity pull/damage. Full resistance schedule is in [02-enemies-and-wave-spec.md](02-enemies-and-wave-spec.md) section 10.

## 11. Arsenals In Combat

`Verified` (renamed from source pack)

There are 9 Arsenals. All owned Arsenals can be slotted into the same run; they auto-fire when their cooldown reaches zero. Each can be toggled on/off mid-run, but the toggle count per run is capped (see Order menu setting).

| # | Arsenal | Role | Upgrades |
|---|---|---|---|
| 1 | **Arc Cascade** | Chance on hit to spawn chain arcs | Damage, Quantity, Proc Chance |
| 2 | **Seeker Salvo** | Tracking missile barrage | Damage, Quantity, Cooldown |
| 3 | **Annihilation Pulse** | Telegraphed pulse then persistent kill wave | Damage, Quantity, Cooldown |
| 4 | **Stasis Field** | Slowing zone | Duration, Slow %, Cooldown |
| 5 | **Proximity Charges** | Auto-deployed inner mine field | Damage, Density, Cooldown |
| 6 | **Resonance Surge** | Economy buff (Scrip/Alloy multiplier window) | Multiplier, Duration, Cooldown |
| 7 | **Corrosive Bloom** | Damage-over-time pool | DoT, Radius, Cooldown |
| 8 | **Singularity** | Pull field | Size, Duration, Cooldown |
| 9 | **Marker Beacon** | Rotating cones that increase damage taken inside | Bonus, Angle, Quantity |

Important: Arsenals are not all damage. Some (Resonance Surge) are economy. Some (Marker Beacon) are vulnerability amplifiers. The mix is what makes late builds layered.

## 12. Cycle Progression

`Verified` (renamed from "wave")

- Each Cycle has a spawn budget (mix of normal types and any scheduled elites/Behemoths/fleet)
- Higher Cycles increase enemy count, HP, and damage along curves defined per Stratum
- **Behemoths** spawn on a Cycle interval (default every 10 Cycles, narrows at higher Strata)
- Elites unlock from Stratum 2 onward
- Fleet enemies appear at very high Cycles or at higher Strata (full schedule in section 16 of [02-enemies-and-wave-spec.md](02-enemies-and-wave-spec.md))
- Cycle Skip honors forced spawns: skipping a fleet Cycle still spawns the fleet group

## 13. Recommended Data Model

`Inferred`

```ts
type SentinelStats = {
  damage: number;
  attackSpeed: number;
  range: number;
  critChance: number;
  critFactor: number;
  superCritChance: number;
  superCritMultiplier: number;
  multishot: number;
  rapidFire: number;
  bounceShot: number;
  damagePerMeter: number;
  rend: number;
  rendMax: number;
  health: number;
  healthRegen: number;
  defensePercent: number;
  defenseAbsolute: number;
  thorns: number;
  lifesteal: number;
  repulseChance: number;
  repulseForce: number;
  pulseSize: number;
  pulseFrequency: number;
  sentries: number;
  sentrySpeed: number;
  chargeChance: number;
  chargeDamage: number;
  chargeRadius: number;
  resilienceSurge: number;
  barrierHealth: number;
  barrierRebuild: number;
  scripBonus: number;
  scripPerCycle: number;
  alloyBonus: number;
  alloyPerKill: number;
  catalystPerKill: number;
  interestPerCycle: number;
  freeAttackUpgrade: number;
  freeDefenseUpgrade: number;
  freeUtilityUpgrade: number;
  repairKits: number;
  cycleSkip: number;
};

type RunState = {
  seed: bigint;
  cycle: number;
  scrip: number;
  stats: SentinelStats;
  arsenals: ArsenalState[];
  enemies: Enemy[];
  projectiles: Projectile[];
  vfx: VFXObject[];
  rng: PRNGState;
  autoProcurement: AutoProcurementRuntimeState;
};
```

## 14. MVP Tick Pseudocode

`Inferred`

```ts
function simulateTick(dt: number, run: RunState) {
  advanceCycleTimer(run, dt);
  spawnCycleUnitsIfNeeded(run);
  updateEnemies(run, dt);
  updateEnemyProjectiles(run, dt);
  evaluateAutoProcurement(run);          // see 08-auto-procurement-spec.md
  updateSentinelAttack(run, dt);
  updateSentriesAndCharges(run, dt);
  updateArsenals(run, dt);
  updateProjectiles(run, dt);
  resolveHits(run);
  resolveSentinelContact(run);
  resolveDeathsAndRewards(run);
  updatePopupsAndEffects(run, dt);
  checkRunEnd(run);
}
```

## 15. Quality Bar

A faithful build hits these outcomes:

- **Drones** (basics) get held at range by damage plus Repulse
- **Skimmers** (fast) leak through more often than Hulks
- **Hulks** (tanks) create attrition pressure
- **Lancers** (ranged) punish defenses that only handle contact
- **Behemoths** (bosses) force endurance checks and lock Protocol swapping while alive
- **Aegis** elites visibly invalidate the Annihilator Beam in their aura
- **Leech** elites interrupt sustain builds
- Fleet enemies force direct-damage answers, defeating passive-only setups
- Multiple autonomous damage systems overlap on screen, but the battlefield remains readable
- Auto-Procurement, when active, visibly purchases upgrades on the cadence the player expects

## 16. Open Questions For The Build Team

- Final Stratum count (recommend 18 at launch, room to extend to 30)
- Behemoth spawn-interval curve per Stratum
- Initial Forge cost curves per stat (suggest exponential `cost = base * 1.07^level`)
- Initial enemy HP/damage curves per Cycle (suggest `hp = base * stratumScale * 1.04^cycle`)
