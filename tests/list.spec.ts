import { describe, expect, it } from "vitest";
import { Err, list, Ok } from "../index";

describe("list", () => {
  it("takes the first n items", () => {
    expect(list([10, 20, 30, 40, 50]).take(2).else([])).toEqual([10, 20]);
  });

  it("skips the first n items", () => {
    expect(list([10, 20, 30, 40, 50]).skip(2).else([])).toEqual([30, 40, 50]);
  });

  it("skips the last n items with a negative count", () => {
    expect(list([10, 20, 30, 40, 50]).skip(-2).else([])).toEqual([10, 20, 30]);
  });

  it("returns a half-open range", () => {
    expect(list([10, 20, 30, 40, 50]).range(1, 4).else([])).toEqual([20, 30, 40]);
  });

  it("normalizes negative range bounds", () => {
    expect(list([10, 20, 30, 40, 50]).range(-3, -1).else([])).toEqual([30, 40]);
    expect(list([10, 20, 30]).range(-1, 3).else([])).toEqual([30]);
  });

  it("allows an empty range at the end", () => {
    expect(list([10, 20, 30]).range(3, 3).else([])).toEqual([]);
  });

  it("fails an out of bounds range with no clamping", () => {
    expect(list([10, 20, 30]).range(1, 99).else([])).toEqual([]);
    expect(list([10, 20, 30]).range(1, 99).category).toBe("OUT_OF_BOUNDS");
    expect(list([10, 20, 30]).range(2, 1).category).toBe("INVALID_RANGE");
  });

  it("panics on an invalid range", () => {
    expect(() => list([10, 20, 30]).range(1, 99).panic("Out of bounds")).toThrow("Out of bounds");
  });

  it("fails take and skip out of bounds", () => {
    expect(list([1, 2]).take(5).else([])).toEqual([]);
    expect(list([1, 2]).take(5).category).toBe("OUT_OF_BOUNDS");
    expect(list([1, 2]).skip(-5).else([])).toEqual([]);
    expect(list([1, 2]).skip(-5).category).toBe("OUT_OF_BOUNDS");
  });

  it("gets by index and normalizes negatives", () => {
    expect(list([10, 20, 30]).get(0).else(-1)).toBe(10);
    expect(list([10, 20, 30]).get(-1).else(-1)).toBe(30);
  });

  it("uses the get fallback when out of bounds", () => {
    expect(list([10, 20, 30]).get(9, -1).else(-2)).toBe(-1);
    expect(list([10, 20, 30]).get(9).category).toBe("OUT_OF_BOUNDS");
  });

  it("distinguishes an explicit undefined fallback from no fallback", () => {
    const values: (number | undefined)[] = [1];
    expect(list(values).get(9, undefined).else(0)).toBeUndefined();
  });

  it("chunks into groups", () => {
    expect(list([1, 2, 3, 4, 5]).chunk(2).else([])).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("fails an invalid chunk size", () => {
    expect(list([1, 2]).chunk(0).category).toBe("INVALID_CHUNK_SIZE");
  });

  it("counts items", () => {
    expect(list([1, 2, 3]).count().else(0)).toBe(3);
  });

  it("prunes with Slang isFalsy by default", () => {
    expect(list([0, false, "", null, undefined, Number.NaN, 5]).prune().else([])).toEqual([0, false, 5]);
  });

  it("prunes with a custom predicate", () => {
    expect(list([-2, 0, 3, 4]).prune((x) => x > 0).else([])).toEqual([3, 4]);
  });

  it("accepts a narrowed Ok", () => {
    expect(list(Ok([1, 2, 3])).take(2).else([])).toEqual([1, 2]);
  });

  it("rejects an Err at runtime", () => {
    expect(list(Err("nope") as any).take(1).category).toBe("INVALID_INPUT");
  });

  it("short-circuits after the first failure", () => {
    expect(list([1, 2]).take(9).skip(1).category).toBe("OUT_OF_BOUNDS");
  });

  it("treats a successful 0 or false as a value, not a fallback", () => {
    expect(list([0]).get(0).else(-1)).toBe(0);
    expect(list([false]).get(0).else(true)).toBe(false);
  });

  it("returns the value from panic on success", () => {
    expect(list([1, 2, 3]).take(2).panic()).toEqual([1, 2]);
  });

  it("rejects non-integer indices and counts", () => {
    expect(list([1, 2]).get(Number.NaN).category).toBe("INVALID_INDEX");
    expect(list([1, 2]).get(1.5).category).toBe("INVALID_INDEX");
    expect(list([1, 2]).take(Number.POSITIVE_INFINITY).category).toBe("INVALID_INDEX");
    expect(list([1, 2]).skip(1.5).category).toBe("INVALID_INDEX");
    expect(list([1, 2]).range(0, Number.NaN).category).toBe("INVALID_INDEX");
  });

  it("handles empty lists without inventing values", () => {
    expect(list([] as number[]).take(0).else([1])).toEqual([]);
    expect(list([] as number[]).skip(0).else([1])).toEqual([]);
    expect(list([] as number[]).range(0, 0).else([1])).toEqual([]);
    expect(list([] as number[]).count().else(-1)).toBe(0);
    expect(list([] as number[]).get(0).category).toBe("OUT_OF_BOUNDS");
  });

  it("rejects a successful Ok that does not hold an array", () => {
    expect(list(Ok("not an array") as any).count().category).toBe("INVALID_INPUT");
  });

  it("passes the original index to a prune predicate", () => {
    expect(
      list(["drop", "keep", "drop"])
        .prune((_value, index) => index === 1)
        .else([]),
    ).toEqual(["keep"]);
  });
});
