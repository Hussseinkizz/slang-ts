import { describe, expect, it, vi } from "vitest";
import { memoized } from "../index";

describe("memoized", () => {
  it("caches by primitive arguments", () => {
    const fn = vi.fn((a: number, b: number) => a + b);
    const add = memoized(fn);

    expect(add(1, 2)).toBe(3);
    expect(add(1, 2)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("compares object arguments by identity", () => {
    const fn = vi.fn((value: { x: number }) => value.x);
    const read = memoized(fn);
    const shared = { x: 1 };

    expect(read(shared)).toBe(1);
    expect(read(shared)).toBe(1);
    expect(read({ x: 1 })).toBe(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("caches undefined as a result", () => {
    const fn = vi.fn(() => undefined as number | undefined);
    const read = memoized(fn);

    expect(read()).toBeUndefined();
    expect(read()).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clears the cache", () => {
    const fn = vi.fn((a: number) => a);
    const read = memoized(fn);

    read(1);
    read.clear();
    read(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("evicts a rejected promise so a retry runs", async () => {
    let calls = 0;
    const fn = vi.fn(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("nope")) : Promise.resolve(5);
    });
    const read = memoized(fn);

    await expect(read()).rejects.toThrow("nope");
    await Promise.resolve();
    await expect(read()).resolves.toBe(5);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache a synchronous throw", () => {
    let calls = 0;
    const read = memoized(() => {
      calls += 1;
      if (calls === 1) throw new Error("nope");
      return calls;
    });

    expect(() => read()).toThrow("nope");
    expect(read()).toBe(2);
  });

  it("keeps argument order distinct", () => {
    const fn = vi.fn((a: number, b: number) => `${a}:${b}`);
    const read = memoized(fn);

    expect(read(1, 2)).toBe("1:2");
    expect(read(2, 1)).toBe("2:1");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
