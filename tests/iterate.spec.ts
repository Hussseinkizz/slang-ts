import { describe, expect, it } from "vitest";
import { Err, Ok } from "../index";

describe("Ok.iterate", () => {
  it("maps, filters and takes lazily", () => {
    const out = Ok([1, 2, 3, 4, 5, 6])
      .iterate()
      .filter((n) => n % 2 === 0)
      .map((n) => n * 10)
      .take(2)
      .toArray()
      .else([]);

    expect(out).toEqual([20, 40]);
  });

  it("stops consumption early with take", () => {
    let consumed = 0;
    function* endless() {
      let value = 0;
      for (;;) {
        consumed += 1;
        yield value++;
      }
    }

    const out = Ok(endless()).iterate().take(3).toArray().else([]);

    expect(out).toEqual([0, 1, 2]);
    expect(consumed).toBe(3);
  });

  it("flatMaps, drops and chunks", () => {
    const out = Ok([1, 2, 3]).iterate().flatMap((n) => [n, n]).drop(1).chunk(2).toArray().else([]);
    expect(out).toEqual([[1, 2], [2, 3], [3]]);
  });

  it("reduces and counts", () => {
    expect(Ok([1, 2, 3]).iterate().reduce((acc, n) => acc + n, 0).else(-1)).toBe(6);
    expect(Ok([1, 2, 3]).iterate().count().else(-1)).toBe(3);
  });

  it("is only exposed by a successful Result", () => {
    expect("iterate" in Err("bad")).toBe(false);
    // @ts-expect-error an Err has no iterate chain
    expect(() => Err("bad").iterate()).toThrow();
  });

  it("reports invalid counts without yielding a partial success", () => {
    expect(Ok([1, 2]).iterate().take(-1).toArray().code).toBe("INVALID_INDEX");
    expect(Ok([1, 2]).iterate().drop(1.5).toArray().code).toBe("INVALID_INDEX");
    expect(Ok([1, 2]).iterate().chunk(0).toArray().code).toBe("INVALID_CHUNK_SIZE");
  });

  it("keeps the mapped collection type through chunk", () => {
    const out = Ok([1, 2]).iterate().map((n) => n * 2).chunk(1).toArray().else([]);
    const typed: readonly number[][] = out;
    expect(typed).toEqual([[2], [4]]);
  });

  it("refuses to replay a one-shot iterator", () => {
    function* values() {
      yield 1;
      yield 2;
    }
    const chain = Ok(values()).iterate();
    expect(chain.toArray().else([])).toEqual([1, 2]);
    expect(chain.toArray().code).toBe("INVALID_INPUT");
  });

  it("captures iteration errors", () => {
    const boom = {
      [Symbol.iterator]() {
        throw new Error("boom");
      },
    };
    const out = Ok(boom).iterate().toArray();
    expect(out.code).toBe("INVALID_INPUT");
    expect(out.else([])).toEqual([]);
  });

  it("fails a non-iterable value at the terminal", () => {
    const out = Ok(42).iterate().toArray();
    expect(out.code).toBe("INVALID_INPUT");
    expect(out.else([])).toEqual([]);
  });

  it("handles counts beyond the source and empty reductions", () => {
    expect(Ok([1, 2]).iterate().take(5).toArray().else([])).toEqual([1, 2]);
    expect(Ok([1, 2]).iterate().drop(5).toArray().else([9])).toEqual([]);
    expect(Ok([] as number[]).iterate().reduce((acc, value) => acc + value, 10).else(-1)).toBe(10);
  });

  it("increments indexes across filtered values", () => {
    expect(
      Ok(["a", "b", "c"])
        .iterate()
        .filter((_value, index) => index !== 1)
        .toArray()
        .else([]),
    ).toEqual(["a", "c"]);
  });

  it("iterates strings by character", () => {
    expect(
      Ok("abc")
        .iterate()
        .map((character) => character.toUpperCase())
        .toArray()
        .else([]),
    ).toEqual(["A", "B", "C"]);
  });

  it("turns transform throws into a failure", () => {
    const out = Ok([1, 2])
      .iterate()
      .map((value) => {
        if (value === 2) throw new Error("boom");
        return value;
      })
      .toArray();

    expect(out.code).toBe("INVALID_INPUT");
    expect(out.else([])).toEqual([]);
  });

  it("closes the source when take stops early", () => {
    let closed = false;
    const source = {
      [Symbol.iterator]() {
        let value = 0;
        return {
          next: () => ({ done: false, value: value++ }),
          return: () => {
            closed = true;
            return { done: true, value: undefined };
          },
        };
      },
    };

    expect(Ok(source).iterate().take(1).toArray().else([])).toEqual([0]);
    expect(closed).toBe(true);
  });
});
