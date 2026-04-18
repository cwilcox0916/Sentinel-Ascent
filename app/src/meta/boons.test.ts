import { describe, it, expect } from "vitest";
import { createRunState } from "../sim/runState.ts";
import { simulateTick } from "../sim/tick.ts";
import { BOON_CYCLE_INTERVAL, chooseBoon, maybeOfferBoons, listBoons } from "./boons.ts";

describe("Boons", () => {
  it("ships 12 starter Boons", () => {
    expect(listBoons().length).toBe(12);
  });

  it("maybeOfferBoons does not offer before the interval cycle", () => {
    const run = createRunState(1n);
    run.cycle = 10;
    maybeOfferBoons(run);
    expect(run.boons.pending).toBeNull();
  });

  it("maybeOfferBoons offers 3 Boons at cycle 25", () => {
    const run = createRunState(3n);
    run.cycle = BOON_CYCLE_INTERVAL;
    maybeOfferBoons(run);
    expect(run.boons.pending).not.toBeNull();
    expect(run.boons.pending!.options.length).toBe(3);
    expect(run.boons.pending!.atCycle).toBe(25);
  });

  it("maybeOfferBoons does not re-offer in the same Cycle after being offered", () => {
    const run = createRunState(5n);
    run.cycle = 25;
    maybeOfferBoons(run);
    const first = run.boons.pending;
    // Consume, then try again same Cycle
    run.boons.pending = null;
    maybeOfferBoons(run);
    expect(run.boons.pending).toBeNull();
    expect(first).not.toBeNull();
  });

  it("chooseBoon applies effect and clears pending", () => {
    const run = createRunState(7n);
    run.cycle = 25;
    maybeOfferBoons(run);
    const offered = run.boons.pending!.options[0]!;
    expect(chooseBoon(run, offered)).toBe("chosen");
    expect(run.boons.pending).toBeNull();
    expect(run.boons.chosen).toContain(offered);
  });

  it("sim tick freezes while a Boon offer is pending", () => {
    const run = createRunState(11n);
    // Force an offer.
    run.boons.pending = { atCycle: 25, options: [listBoons()[0]!.id] };
    const tickBefore = run.tickNumber;
    for (let i = 0; i < 10; i++) simulateTick(run);
    expect(run.tickNumber).toBe(tickBefore);
  });

  it("deterministic: same seed + same Cycle produces same offered options", () => {
    const a = createRunState(42n);
    const b = createRunState(42n);
    a.cycle = 25; b.cycle = 25;
    maybeOfferBoons(a);
    maybeOfferBoons(b);
    expect(a.boons.pending?.options).toEqual(b.boons.pending?.options);
  });
});
