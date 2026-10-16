import { describe, expect, expectTypeOf, it } from "vitest";
import { atom, Err, Ok, option, safeTry } from "../index";
import type { Result } from "../index";

type NestedValue = { type: "Ok"; isOk: true; value: number | NestedValue };
type CircularValue = { type: "Ok"; isOk: true; value?: CircularValue };

describe("safeTry recursive value resolution", () => {
  it("unwraps deeply nested successful Results and infers the terminal value", async () => {
    const result = await safeTry(() => Ok(Ok(Ok(42))));
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    expect(result.isOk).toBe(true);
    expect(result.expect()).toBe(42);
  });

  it("unwraps mixed Result, Option and Atom chains", async () => {
    const result = await safeTry(() => Ok(option(Ok(atom("ready")))));
    expectTypeOf(result).toEqualTypeOf<Result<"ready", string>>();
    expect(result.expect()).toBe("ready");
  });

  it("propagates the first nested Err", async () => {
    const result = await safeTry(() => Ok(option(Ok(Err("deep failure")))));
    expectTypeOf(result).toEqualTypeOf<Result<never, string>>();
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("deep failure");
  });

  it("preserves existing string normalization for Result-like failures", async () => {
    const result = await safeTry(() => Ok({ type: "Err", isOk: false, isErr: true, error: 404 }));
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("404");
  });

  it("propagates nested None", async () => {
    const result = await safeTry(() => Ok(option(Ok(option(null)))));
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Option was None");
  });

  it("awaits the callback before recursively resolving its result", async () => {
    const result = await safeTry(async () => Ok(option(Ok(42))));
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    expect(result.expect()).toBe(42);
  });

  it("resolves nested safeTry calls", async () => {
    const result = await safeTry(() => safeTry(() => safeTry(() => Ok(42))));
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    expect(result.expect()).toBe(42);
    const failure = await safeTry(() => safeTry(() => Ok(Err("inner failure"))));
    expect(failure.isErr).toBe(true);
    if (failure.isErr) expect(failure.error).toBe("inner failure");
  });

  it("preserves a Promise carried inside a wrapper", async () => {
    const payload = Promise.resolve(42);
    const result = await safeTry(() => Ok(option(payload)));
    expectTypeOf(result).toEqualTypeOf<Result<Promise<number>, string>>();
    expect(result.expect()).toBe(payload);
    expect(await result.expect()).toBe(42);
  });

  it("preserves plain object identity and its wrapped properties", async () => {
    const payload = { value: Ok(42), failure: Err("stored") };
    const result = await safeTry(() => Ok(option(payload)));
    expectTypeOf(result).toEqualTypeOf<Result<typeof payload, string>>();
    expect(result.expect()).toBe(payload);
    expect(result.expect().value).toBe(payload.value);
    expect(result.expect().failure).toBe(payload.failure);
  });

  it("preserves array identity and its wrapped elements", async () => {
    const payload = [Ok(42), Err("stored")];
    const result = await safeTry(() => Ok(payload));
    expectTypeOf(result).toEqualTypeOf<Result<typeof payload, string>>();
    expect(result.expect()).toBe(payload);
    expect(result.expect()[0]).toBe(payload[0]);
  });

  it("keeps returned failures as Results when throw is enabled", async () => {
    const result = await safeTry(() => Ok(Err("returned failure")), { throw: true });
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("returned failure");
  });

  it("preserves thrown Error identity when throw is enabled", async () => {
    const failure = new Error("callback failure");
    await expect(safeTry(() => { throw failure; }, { throw: true })).rejects.toBe(failure);
  });

  it("normalizes non-Error throws when throw is enabled", async () => {
    await expect(safeTry(() => { throw 404; }, { throw: true })).rejects.toThrow("404");
  });

  it("captures errors thrown while evaluating nested wrappers", async () => {
    const nested = {
      type: "Ok", isOk: true,
      get value(): number { throw new Error("evaluation failure"); },
    };
    const result = await safeTry(() => Ok(nested));
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("evaluation failure");
  });

  it("rethrows the original evaluation error when throw is enabled", async () => {
    const failure = new Error("evaluation failure");
    const nested = {
      type: "Ok", isOk: true,
      get value(): number { throw failure; },
    };
    await expect(safeTry(() => Ok(nested), { throw: true })).rejects.toBe(failure);
  });

  it("resolves long chains without recursive call-stack growth", async () => {
    const nested = Array.from({ length: 20_000 }).reduce<number | NestedValue>(
      (value) => ({ type: "Ok", isOk: true, value }),
      42,
    );
    const result = await safeTry(() => nested);
    expect(result.isOk).toBe(true);
    expect(result.expect()).toBe(42);
  });

  it.each([false, true])("returns Err for cyclic wrappers with throw:%s", async (shouldThrow) => {
    const circular: CircularValue = { type: "Ok", isOk: true };
    circular.value = circular;
    const result = await safeTry(() => circular, { throw: shouldThrow });
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Cannot resolve a circular value");
  });
});
