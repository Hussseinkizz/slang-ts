import { describe, expect, expectTypeOf, it } from "vitest";
import { atom, Err, Ok, option, safeTry } from "../index";
import type { Result } from "../index";

type NestedOption = { isSome: true; isNone: false; value?: NestedOption };

describe("safeTry result resolution and the no-nested-Result rule", () => {
  it("rejects a nested Result at the type level", () => {
    // Only type-checked; the guard fails these at compile time. Never executed.
    const buildNested = (): void => {
      // @ts-expect-error a Result cannot nest inside another Result
      Ok(Ok(42));
      // @ts-expect-error a Result cannot nest inside another Result
      Ok(Err("boom"));
    };
    expect(typeof buildNested).toBe("function");
  });

  it("throws when Ok wraps a Result at runtime", () => {
    const inner: unknown = Ok(42);
    expect(() => Ok(inner)).toThrow("A Result cannot be nested inside another Result");
  });

  it("rejects a fn returning a Result whose value is a Result at the type level", () => {
    const check = (): void => {
      const nested = {
        type: "Ok", isOk: true, isErr: false, value: Ok(42),
      } as unknown as Result<Result<number, string>, string>;
      // @ts-expect-error a Result's value cannot be another Result
      safeTry(() => nested);
    };
    expect(typeof check).toBe("function");
  });

  it("panics on an Ok wrapping an Ok at runtime", async () => {
    const inner = Ok(42);
    const nested = { type: "Ok", isOk: true, isErr: false, value: inner } as unknown;

    await expect(safeTry(() => nested)).rejects.toThrow(
      "A Result cannot be nested inside another Result",
    );
  });

  it("panics on an Ok wrapping an Err at runtime", async () => {
    const inner = Err("boom");
    const nested = { type: "Ok", isOk: true, isErr: false, value: inner } as unknown;

    await expect(safeTry(() => nested)).rejects.toThrow(
      "A Result cannot be nested inside another Result",
    );
  });

  it("unwraps Option and Atom chains and infers the terminal value", async () => {
    const result = await safeTry(() => Ok(option(atom("ready"))));
    expectTypeOf(result).toEqualTypeOf<Result<"ready", string>>();
    expect(result.expect()).toBe("ready");
  });

  it("unwraps nested Options", async () => {
    const result = await safeTry(() => option(option(42)));
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    expect(result.expect()).toBe(42);
  });

  it("awaits the callback before resolving its result", async () => {
    const result = await safeTry(async () => Ok(option(42)));
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    expect(result.expect()).toBe(42);
  });

  it("resolves nested safeTry calls", async () => {
    const result = await safeTry(() => safeTry(() => safeTry(() => Ok(42))));
    expectTypeOf(result).toEqualTypeOf<Result<number, string>>();
    expect(result.expect()).toBe(42);
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

  it("keeps a returned failure as a Result when throw is enabled", async () => {
    const result = await safeTry(() => Err("returned failure"), { throw: true });
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

  it("captures errors thrown while evaluating wrappers", async () => {
    const wrapped = {
      isSome: true,
      isNone: false,
      get value(): number { throw new Error("evaluation failure"); },
    };
    const result = await safeTry(() => Ok(wrapped));
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("evaluation failure");
  });

  it("rethrows the original evaluation error when throw is enabled", async () => {
    const failure = new Error("evaluation failure");
    const wrapped = {
      isSome: true,
      isNone: false,
      get value(): number { throw failure; },
    };
    await expect(safeTry(() => Ok(wrapped), { throw: true })).rejects.toBe(failure);
  });

  it("resolves long Option chains without recursive call-stack growth", async () => {
    const nested = Array.from({ length: 20_000 }).reduce<unknown>(
      (value) => ({ isSome: true, isNone: false, value }),
      42,
    );
    const result = await safeTry(() => nested);
    expect(result.isOk).toBe(true);
    expect(result.expect()).toBe(42);
  });

  it.each([false, true])("returns Err for circular Options with throw:%s", async (shouldThrow) => {
    const circular: NestedOption = { isSome: true, isNone: false };
    circular.value = circular;
    const result = await safeTry(() => circular, { throw: shouldThrow });
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Cannot resolve a circular value");
  });
});
