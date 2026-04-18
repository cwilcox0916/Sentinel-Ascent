import { describe, it, expect } from "vitest";
import {
  applyProtocols,
  buyProtocolCopy,
  copiesToNextLevel,
  createProtocolSlotState,
  equipProtocol,
  levelUpProtocol,
  listProtocols,
  MAX_PROTOCOL_LEVEL,
} from "./protocols.ts";
import { DEFAULT_SENTINEL_STATS } from "../sim/runState.ts";

describe("Protocols", () => {
  it("ships 10 starter Protocols", () => {
    expect(listProtocols().length).toBe(10);
  });

  it("cannot equip an unowned Protocol", () => {
    const ps = createProtocolSlotState();
    equipProtocol(ps, 0, "overclock");
    expect(ps.equipped[0]).toBeNull();
  });

  it("buyProtocolCopy grants level 1 on first buy, then adds copies", () => {
    const ps = createProtocolSlotState();
    const cur = { prisms: 50 };
    expect(buyProtocolCopy(ps, cur, "overclock")).toBe("bought");
    expect(ps.levels["overclock"]).toBe(1);
    expect(cur.prisms).toBe(40);
    expect(buyProtocolCopy(ps, cur, "overclock")).toBe("bought");
    expect(ps.levels["overclock"]).toBe(1);
    expect(ps.copies["overclock"]).toBe(1);
  });

  it("level-up spends the right number of copies", () => {
    const ps = createProtocolSlotState();
    ps.levels["overclock"] = 1;
    // 1 → 2 needs 2 copies
    ps.copies["overclock"] = 2;
    const result = levelUpProtocol(ps, "overclock");
    expect(result).toBe(2);
    expect(ps.copies["overclock"]).toBe(0);
  });

  it("copiesToNextLevel doubles each level", () => {
    expect(copiesToNextLevel(1)).toBe(2);
    expect(copiesToNextLevel(2)).toBe(4);
    expect(copiesToNextLevel(6)).toBe(64);
    expect(copiesToNextLevel(MAX_PROTOCOL_LEVEL)).toBe(Infinity);
  });

  it("applyProtocols layers equipped effects onto base stats", () => {
    const ps = createProtocolSlotState();
    ps.levels["overclock"] = 5; // +40% damage
    ps.equipped[0] = "overclock";
    const stats = { ...DEFAULT_SENTINEL_STATS };
    applyProtocols(ps, stats);
    expect(stats.damage).toBeCloseTo(DEFAULT_SENTINEL_STATS.damage * 1.4, 5);
  });

  it("equipping the same Protocol in two slots unequips the earlier slot", () => {
    const ps = createProtocolSlotState();
    ps.levels["overclock"] = 1;
    equipProtocol(ps, 0, "overclock");
    equipProtocol(ps, 2, "overclock");
    expect(ps.equipped[0]).toBeNull();
    expect(ps.equipped[2]).toBe("overclock");
  });
});
