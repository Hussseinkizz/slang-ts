import { describe, expect, it } from "vitest";
import { Ok, safeTry } from "../index";

/** Routes a thrown value through safeTry and returns the resulting Err text. */
const messageOf = async (thrown: unknown): Promise<string> => {
  const result = await safeTry(() => {
    throw thrown;
  });
  if (result.isErr) return result.error;
  throw new Error("expected a failure");
};

describe("thrown value normalization", () => {
  it("keeps an Error message", async () => {
    expect(await messageOf(new Error("boom"))).toBe("boom");
  });

  it("keeps a thrown string", async () => {
    expect(await messageOf("boom")).toBe("boom");
  });

  it("reads the message field of a thrown object", async () => {
    expect(await messageOf({ message: "boom", code: "E1" })).toBe("boom");
  });

  it("reads the error field of a thrown object", async () => {
    expect(await messageOf({ error: "boom" })).toBe("boom");
  });

  it("reads the reason field of a thrown object", async () => {
    expect(await messageOf({ reason: "boom" })).toBe("boom");
  });

  it("falls back to JSON text for an object with no known field", async () => {
    expect(await messageOf({ custom: "object" })).toBe('{"custom":"object"}');
  });

  it("turns a thrown bigint into decimal text", async () => {
    expect(await messageOf(BigInt(10))).toBe("10");
  });

  it("does not throw on a cyclic object", async () => {
    const cyclic: Record<string, unknown> = { name: "loop" };
    cyclic.self = cyclic;

    const message = await messageOf(cyclic);

    expect(message).toContain("[Circular]");
  });

  it("bounds a large payload", async () => {
    const message = await messageOf({ data: "x".repeat(2000) });

    expect(message.length).toBeLessThan(600);
    expect(message.endsWith("...")).toBe(true);
  });

  it("renders null and undefined", async () => {
    expect(await messageOf(null)).toBe("null");
    expect(await messageOf(undefined)).toBe("undefined");
  });

  it("renders a thrown number", async () => {
    expect(await messageOf(404)).toBe("404");
  });

  it("stops a non-string Result error rendering as [object Object]", async () => {
    const bad = { type: "Err", error: { code: "E2" }, isOk: false, isErr: true };

    const result = await safeTry(() => bad);

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe('{"code":"E2"}');
  });
});
