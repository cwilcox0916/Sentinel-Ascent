import { describe, it, expect, beforeEach } from "vitest";
import {
  clearTelemetry,
  isTelemetryEnabled,
  logEvent,
  setTelemetryEnabled,
  telemetryCount,
} from "./telemetry.ts";

// Minimal localStorage shim for tests.
class LS {
  private store = new Map<string, string>();
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, v); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: LS }).localStorage = new LS();
  (globalThis as unknown as { navigator: { userAgent: string } }).navigator ??= { userAgent: "test-ua" };
  // Reset enabled state between tests.
  setTelemetryEnabled(false);
});

describe("Telemetry", () => {
  it("drops events when opted out", () => {
    expect(isTelemetryEnabled()).toBe(false);
    logEvent("run-start", { seed: "abc" });
    expect(telemetryCount()).toBe(0);
  });

  it("captures events once opted in", () => {
    setTelemetryEnabled(true);
    expect(isTelemetryEnabled()).toBe(true);
    // session-start was auto-logged on opt-in
    const baseline = telemetryCount();
    logEvent("run-start", { seed: "abc" });
    logEvent("run-end", { cycle: 12 });
    expect(telemetryCount()).toBe(baseline + 2);
  });

  it("clearTelemetry drains the queue + storage", () => {
    setTelemetryEnabled(true);
    logEvent("run-end", { cycle: 5 });
    expect(telemetryCount()).toBeGreaterThan(0);
    clearTelemetry();
    expect(telemetryCount()).toBe(0);
  });

  it("opt-out wipes the queue", () => {
    setTelemetryEnabled(true);
    logEvent("run-end", { cycle: 1 });
    setTelemetryEnabled(false);
    expect(telemetryCount()).toBe(0);
  });
});
