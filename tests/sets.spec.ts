import { describe, expect, it } from "vitest";
import { Err, Ok, sets } from "../index";

describe("sets", () => {
  it("treats object keys as members regardless of value", () => {
    expect(sets({ read: true, write: false }).has("write").else(false)).toBe(true);
    expect(sets({ read: true }).has("nope").else(true)).toBe(false);
  });

  it("uniques, unions, intersects and differences", () => {
    expect([...sets([1, 2, 2, 3]).unique().else(new Set())]).toEqual([1, 2, 3]);
    expect([...sets([1, 2]).union([2, 3]).else(new Set())]).toEqual([1, 2, 3]);
    expect([...sets([1, 2, 3]).intersection([2, 3, 4]).else(new Set())]).toEqual([2, 3]);
    expect([...sets([1, 2, 3]).difference([2]).else(new Set())]).toEqual([1, 3]);
  });

  it("reads Map keys and native Sets", () => {
    expect([...sets(new Map([["a", 1], ["b", 2]])).unique().else(new Set())]).toEqual(["a", "b"]);
    expect(sets(new Set([1, 2])).count().else(0)).toBe(2);
  });

  it("counts distinct members", () => {
    expect(sets([1, 1, 2]).count().else(0)).toBe(2);
  });

  it("fails on unsupported input", () => {
    expect(sets(42 as any).count().category).toBe("INVALID_INPUT");
  });

  it("accepts a narrowed Ok and refuses an Err", () => {
    expect(sets(Ok([1, 2])).count().else(0)).toBe(2);
    expect(sets(Ok({ read: true })).has("read").else(false)).toBe(true);
    expect(sets(Err("nope") as any).count().category).toBe("INVALID_INPUT");
  });

  it("compares objects by identity", () => {
    const member = { id: 1 };
    expect(sets([member]).has(member).else(false)).toBe(true);
    expect(sets([member]).has({ id: 1 }).else(true)).toBe(false);
  });

  it("uses string characters and ignores inherited object keys", () => {
    expect(sets("aba").count().else(0)).toBe(2);

    const inherited = Object.create({ secret: 1 }) as Record<string, unknown>;
    inherited.visible = true;
    expect(sets(inherited).has("visible").else(false)).toBe(true);
    expect(sets(inherited).has("secret").else(true)).toBe(false);
  });

  it("unions object keys and rejects unsupported operands", () => {
    expect([...sets(["a"]).union({ b: 1 }).else(new Set())]).toEqual(["a", "b"]);
    expect([...sets(["a"]).union(Ok({ b: 1 })).else(new Set())]).toEqual(["a", "b"]);
    expect(sets([1]).union(42 as any).category).toBe("INVALID_INPUT");
  });

  it("keeps prototype-looking object keys as members", () => {
    const record = Object.fromEntries([["__proto__", 1]]);
    expect(sets(record).has("__proto__").else(false)).toBe(true);
    expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
  });

  it("handles empty collections", () => {
    expect(sets([] as number[]).count().else(-1)).toBe(0);
    expect([...sets([] as number[]).unique().else(new Set([1]))]).toEqual([]);
  });
});
