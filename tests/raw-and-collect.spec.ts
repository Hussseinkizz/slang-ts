import { describe, expect, it } from "vitest";
import { Err, Ok, option, safeTry } from "../index";

describe("Err raw payload", () => {
  it("keeps the raw cause on a non-enumerable property", () => {
    const cause = { code: "E1", detail: "driver refused" };
    const result = Err("boom", cause);

    expect(result.error).toBe("boom");
    expect(result.raw).toBe(cause);
    expect(Object.keys(result)).not.toContain("raw");
    expect(JSON.stringify(result)).not.toContain("raw");
  });

  it("leaves raw undefined when no cause is passed", () => {
    expect(Err("boom").raw).toBeUndefined();
  });
});

describe("safeTry raw on a caught throw", () => {
  it("carries the thrown object beside the safe message", async () => {
    const cause = { code: "E2" };
    const result = await safeTry(() => {
      throw cause;
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBe('{"code":"E2"}');
      expect(result.raw).toBe(cause);
    }
  });

  it("carries a thrown Error instance", async () => {
    const cause = new Error("kaboom");
    const result = await safeTry(() => {
      throw cause;
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBe("kaboom");
      expect(result.raw).toBe(cause);
    }
  });

  it("carries the raw cause from a returned Err", async () => {
    const cause = { code: "E3" };
    const result = await safeTry(() => Err("boom", cause));

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBe("boom");
      expect(result.raw).toBe(cause);
    }
  });

  it("does not set raw on a plain success", async () => {
    const result = await safeTry(() => "ok");

    expect(result.isOk).toBe(true);
    expect(result.raw).toBeUndefined();
  });
});

describe("safeTry collectValues", () => {
  it("collects each unwrapped layer and the terminal value", async () => {
    const result = await safeTry(() => Ok(option("deep")), { collectValues: true });

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe("deep");

    const raw = result.raw as { errors: unknown[]; values: unknown[] };
    expect(raw.values).toHaveLength(2);
    expect(raw.errors).toHaveLength(0);
    expect(raw.values[1]).toBe("deep");
  });

  it("collects the error on a failure", async () => {
    const result = await safeTry(() => Err("boom"), { collectValues: true });

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("boom");

    const raw = result.raw as { errors: unknown[]; values: unknown[] };
    expect(raw.errors).toEqual(["boom"]);
    expect(raw.values).toHaveLength(0);
  });

  it("collects a thrown error", async () => {
    const cause = new Error("thrown");
    const result = await safeTry(
      () => {
        throw cause;
      },
      { collectValues: true },
    );

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("thrown");

    const raw = result.raw as { errors: unknown[]; values: unknown[] };
    expect(raw.errors[0]).toBe(cause);
  });

  it("walks a mixed Result and Option chain", async () => {
    const result = await safeTry(() => Ok(option(5)), { collectValues: true });

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(5);

    const raw = result.raw as { errors: unknown[]; values: unknown[] };
    expect(raw.values).toHaveLength(2);
    expect(raw.values[1]).toBe(5);
  });

  it("panics on a nested Result", async () => {
    const inner = Ok(42);
    const nested = { type: "Ok", isOk: true, isErr: false, value: inner } as unknown;

    await expect(safeTry(() => nested, { collectValues: true })).rejects.toThrow(
      "A Result cannot be nested inside another Result",
    );
  });

  it("keeps the collected raw non-enumerable", async () => {
    const result = await safeTry(() => Ok("ok"), { collectValues: true });

    expect(Object.keys(result)).not.toContain("raw");
    expect(JSON.stringify(result)).not.toContain("raw");
  });

  it("sets no raw when collectValues is off", async () => {
    const result = await safeTry(() => Ok(option("deep")));

    expect(result.isOk).toBe(true);
    expect(result.raw).toBeUndefined();
  });
});
