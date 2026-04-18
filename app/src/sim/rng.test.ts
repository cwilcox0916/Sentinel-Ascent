import { describe, it, expect } from "vitest";
import { createRng, nextU64, nextFloat, serialize, deserialize } from "./rng.ts";

describe("xoroshiro128+ PRNG", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42n);
    const b = createRng(42n);
    for (let i = 0; i < 100; i++) {
      expect(nextU64(a)).toBe(nextU64(b));
    }
  });

  it("produces different streams for different seeds", () => {
    const a = createRng(1n);
    const b = createRng(2n);
    expect(nextU64(a)).not.toBe(nextU64(b));
  });

  it("nextFloat stays within [0, 1)", () => {
    const r = createRng(99n);
    for (let i = 0; i < 1000; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("survives serialize/deserialize round-trip", () => {
    const a = createRng(7n);
    for (let i = 0; i < 50; i++) nextU64(a);
    const restored = deserialize(serialize(a));
    for (let i = 0; i < 100; i++) {
      expect(nextU64(restored)).toBe(nextU64(a));
    }
  });
});
