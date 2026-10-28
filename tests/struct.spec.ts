import { describe, expect, it } from "vitest";
import { Err, Ok, struct } from "../index";

const user = { id: 1, name: "Ada", password: "secret", profile: { city: "Kampala" } };

describe("struct", () => {
  it("gets a nested path, with a fallback", () => {
    expect(struct(user).get(["profile", "city"]).else("unknown")).toBe("Kampala");
    expect(struct(user).get("missing").else("none")).toBe("none");
    expect(struct(user).get("missing").category).toBe("OUT_OF_BOUNDS");
    expect(struct(user).get("missing", undefined).else("none")).toBeUndefined();
  });

  it("picks and omits keys without mutating", () => {
    expect(struct(user).pick("id", "name").panic()).toEqual({ id: 1, name: "Ada" });
    expect(struct(user).omit("password").panic()).toEqual({
      id: 1,
      name: "Ada",
      profile: { city: "Kampala" },
    });
  });

  it("deep merges plain objects without mutating the input", () => {
    const merged = struct(user).merge({ active: true, profile: { country: "UG" } }).panic();
    expect(merged).toEqual({
      id: 1,
      name: "Ada",
      password: "secret",
      profile: { city: "Kampala", country: "UG" },
      active: true,
    });
    expect(user.profile).toEqual({ city: "Kampala" });
  });

  it("counts own keys", () => {
    expect(struct(user).count().else(0)).toBe(4);
  });

  it("counts and indexes a collection", () => {
    const rows = [
      { id: 1, role: "admin" },
      { id: 2, role: "user" },
      { id: 3, role: "admin" },
    ];
    expect(struct(rows).countBy((row) => row.role).else({})).toEqual({ admin: 2, user: 1 });
    expect(struct(rows).keyBy((row) => row.id).else({})).toEqual({
      1: rows[0],
      2: rows[1],
      3: rows[2],
    });
  });

  it("accepts a narrowed Ok and refuses an Err", () => {
    expect(struct(Ok(user)).get("name").else("none")).toBe("Ada");
    expect(struct(Err("nope") as any).count().category).toBe("INVALID_INPUT");
  });

  it("does not read inherited properties", () => {
    const inherited = Object.create({ secret: "leaked" }) as Record<string, unknown>;
    inherited.visible = true;
    expect(struct(inherited).get("secret").category).toBe("OUT_OF_BOUNDS");
    expect(struct(inherited).pick("secret").panic()).toEqual({});
  });

  it("uses prototype-safe keys for grouping", () => {
    const rows = [{ key: "__proto__" }, { key: "__proto__" }, { key: "constructor" }];
    expect(struct(rows).countBy((row) => row.key).else({})).toEqual({
      ["__proto__"]: 2,
      constructor: 1,
    });
    expect(Object.hasOwn(struct(rows).keyBy((row) => row.key).else({}), "__proto__")).toBe(true);
  });

  it("keeps prototype-looking keys as own properties when shaping", () => {
    const record = Object.fromEntries([
      ["__proto__", 1],
      ["safe", 2],
    ]);
    const picked = struct(record).pick("__proto__").panic() as Record<string, unknown>;
    const omitted = struct(record).omit("safe").panic() as Record<string, unknown>;
    const pruned = struct(record).prune(() => true).panic() as Record<string, unknown>;

    expect(Object.hasOwn(picked, "__proto__")).toBe(true);
    expect(Object.hasOwn(omitted, "__proto__")).toBe(true);
    expect(Object.hasOwn(pruned, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(picked)).toBe(Object.prototype);
  });

  it("prunes falsy fields but keeps 0 and false", () => {
    expect(struct({ a: 0, b: false, c: "", d: 5 }).prune().panic()).toEqual({ a: 0, b: false, d: 5 });
  });

  it("prunes with a custom predicate", () => {
    expect(struct({ a: 1, b: 2, c: 3 }).prune((value) => (value as number) > 1).panic()).toEqual({
      b: 2,
      c: 3,
    });
  });

  it("fails record operations on a collection input", () => {
    expect(struct([1, 2, 3]).get("x").category).toBe("INVALID_INPUT");
  });

  it("omits missing pick keys and leaves unknown omit keys alone", () => {
    const loose: Record<string, unknown> = { a: 1 };
    expect(struct(loose).pick("missing").panic()).toEqual({});
    expect(struct(loose).omit("missing").panic()).toEqual({ a: 1 });
  });

  it("replaces arrays and skips forbidden keys when merging", () => {
    const patch = Object.fromEntries([
      ["__proto__", { polluted: true }],
      ["list", [2]],
    ]);
    const merged = struct({ list: [1], safe: true }).merge(patch).panic() as Record<
      string,
      unknown
    >;

    expect(merged.list).toEqual([2]);
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects a non-record merge source", () => {
    expect(struct({ a: 1 }).merge(null as never).category).toBe("INVALID_INPUT");
  });

  it("keeps the last value for duplicate keyBy keys", () => {
    const rows = [
      { id: 1, value: "first" },
      { id: 1, value: "last" },
    ];
    expect(struct(rows).keyBy((row) => row.id).else({})[1]).toEqual(rows[1]);
  });

  it("stringifies grouping keys and handles empty collections", () => {
    expect(struct([{ value: 1 }, { value: 1 }, { value: 2 }]).countBy((row) => row.value).else({})).toEqual(
      { 1: 2, 2: 1 },
    );
    const empty: { id: number }[] = [];
    expect(struct(empty).countBy((row) => row.id).else({ a: 1 })).toEqual({});
    expect(struct(empty).keyBy((row) => row.id).else({})).toEqual({});
  });

  it("fails a nested path through a non-record value", () => {
    expect(struct({ profile: null }).get(["profile", "city"]).category).toBe("OUT_OF_BOUNDS");
  });
});
