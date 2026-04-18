import { describe, it, expect } from "vitest";
import { RunLog } from "./runLog.ts";

describe("RunLog", () => {
  it("throttles HP samples to ~2 Hz", () => {
    const log = new RunLog(0);
    log.sampleHp(1.0, 1, 0);
    log.sampleHp(0.9, 1, 100);
    log.sampleHp(0.8, 1, 200);
    log.sampleHp(0.7, 1, 460);
    const snap = log.snapshot(500, 1);
    expect(snap.hpSamples.length).toBe(2);
    expect(snap.hpSamples[0]!.hpFrac).toBe(1.0);
    expect(snap.hpSamples[1]!.hpFrac).toBe(0.7);
  });

  it("tracks peak DPS over a 3s window", () => {
    const log = new RunLog(0);
    // 30 damage over 3s → 10 dps
    for (let i = 0; i < 30; i++) log.recordDamage(1, i * 100);
    const snap = log.snapshot(3000, 1);
    expect(snap.peakDps).toBeGreaterThanOrEqual(9);
    expect(snap.peakDps).toBeLessThanOrEqual(10.1);
  });

  it("expires DPS contributions outside window", () => {
    const log = new RunLog(0);
    log.recordDamage(100, 0);
    log.recordDamage(1, 4000); // old window entry evicted
    const snap = log.snapshot(4000, 1);
    expect(snap.peakDps).toBeGreaterThanOrEqual(30);
    expect(snap.peakDps).toBeLessThanOrEqual(34);
  });

  it("captures events with tags", () => {
    const log = new RunLog(0);
    log.pushEvent("event", "Behemoth on Grid", 10, "BHM", 5000);
    log.pushEvent("good", "Heirloom acquired", 12, undefined, 6000);
    log.pushEvent("death", "Sentinel offline", 14, undefined, 7000);
    const snap = log.snapshot(7000, 14);
    expect(snap.events.length).toBe(3);
    expect(snap.events[0]!.tag).toBe("BHM");
    expect(snap.events[0]!.kind).toBe("event");
    expect(snap.events[2]!.kind).toBe("death");
  });

  it("accumulates kills", () => {
    const log = new RunLog(0);
    log.addKills(3);
    log.addKills(5);
    expect(log.snapshot(0, 1).kills).toBe(8);
  });

  it("caps the HP sample buffer", () => {
    const log = new RunLog(0);
    for (let i = 0; i < 500; i++) log.sampleHp(1 - i / 500, 1, i * 500);
    const snap = log.snapshot(500 * 500, 1);
    expect(snap.hpSamples.length).toBeLessThanOrEqual(240);
  });
});
