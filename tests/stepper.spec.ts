import { describe, expect, it } from "vitest";
import { createStepper } from "../index";

describe("createStepper", () => {
  it("commits steps and exposes current and size", async () => {
    const stepper = createStepper<{ screen: string }>({ maxHistory: 5 });
    expect(stepper.current).toBeUndefined();
    expect(stepper.size).toBe(0);

    const first = await stepper.next((previous, make) => {
      expect(previous).toBeUndefined();
      return make({ key: "a", value: { screen: "welcome" } });
    });
    expect(first.isOk).toBe(true);
    expect(stepper.current?.key).toBe("a");
    expect(stepper.size).toBe(1);

    await stepper.next((previous, make) => make({ key: "b", value: { screen: "details" } }));
    expect(stepper.current?.key).toBe("b");
    expect(stepper.size).toBe(2);
  });

  it("panics on a duplicate retained key", async () => {
    const stepper = createStepper<number>();
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));

    await expect(
      stepper.next((previous, make) => make({ key: "a", value: 2 })),
    ).rejects.toThrow("Duplicate step key");
  });

  it("returns Err without advancing, or the current step with fallback", async () => {
    const stepper = createStepper<number>();
    const failed = await stepper.next(() => {
      throw new Error("boom");
    });
    expect(failed.isErr).toBe(true);
    expect(stepper.size).toBe(0);

    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    const fallen = await stepper.next(
      () => {
        throw new Error("boom");
      },
      { fallback: true },
    );
    expect(fallen.isOk).toBe(true);
    if (fallen.isOk) expect(fallen.value.key).toBe("a");
    expect(stepper.size).toBe(1);
  });

  it("moves current backward through retained history", async () => {
    const stepper = createStepper<number>({ maxHistory: 5 });
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    await stepper.next((previous, make) => make({ key: "b", value: 2 }));
    await stepper.next((previous, make) => make({ key: "c", value: 3 }));

    expect(stepper.prev().else((previous, make) => make({ key: "x", value: 0 })).key).toBe("b");
    expect(stepper.current?.key).toBe("b");
    expect(stepper.prev().panic().key).toBe("a");
    expect(stepper.current?.key).toBe("a");
  });

  it("replaces the abandoned forward branch after navigating backward", async () => {
    const stepper = createStepper<number>({ maxHistory: 5 });
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    await stepper.next((previous, make) => make({ key: "b", value: 2 }));
    await stepper.next((previous, make) => make({ key: "c", value: 3 }));

    stepper.prev().panic();
    await stepper.next((previous, make) => make({ key: "d", value: 4 }));
    expect(stepper.current?.key).toBe("d");
    expect(stepper.size).toBe(3);

    await stepper.next((previous, make) => make({ key: "c", value: 5 }));
    expect(stepper.current?.key).toBe("c");
    expect(stepper.size).toBe(4);
  });

  it("reconstructs evicted history with else, and panics without it", async () => {
    const stepper = createStepper<number>({ maxHistory: 2 });
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    await stepper.next((previous, make) => make({ key: "b", value: 2 }));
    await stepper.next((previous, make) => make({ key: "c", value: 3 }));
    expect(stepper.size).toBe(2);

    expect(() => stepper.prev(-2).panic("missing")).toThrow("missing");
    expect(stepper.prev(-2).else((previous, make) => make({ key: "a", value: 1 })).key).toBe("a");
    expect(stepper.current?.key).toBe("a");
    expect(stepper.size).toBe(2);
  });

  it("refuses to step before the first step", async () => {
    const stepper = createStepper<number>();
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));

    expect(() => stepper.prev().else((previous, make) => make({ key: "x", value: 0 }))).toThrow(
      "Cannot step before the first step",
    );
    expect(() => stepper.prev().panic()).toThrow("Cannot step before the first step");
  });

  it("serializes concurrent forward generations", async () => {
    const stepper = createStepper<number>();
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const [first, second] = await Promise.all([
      stepper.next(async (previous, make) => {
        await delay(5);
        return make({ key: "a", value: 1 });
      }),
      stepper.next((previous, make) => make({ key: "b", value: 2 })),
    ]);

    expect(first.isOk).toBe(true);
    expect(second.isOk).toBe(true);
    expect(stepper.size).toBe(2);
    expect(stepper.current?.key).toBe("b");
  });

  it("panics when keyEvalFn rejects a key", async () => {
    const stepper = createStepper<number>({ keyEvalFn: async () => false });
    await expect(
      stepper.next((previous, make) => make({ key: "a", value: 1 })),
    ).rejects.toThrow("Step key rejected");
  });

  it("enforces maxSteps", async () => {
    const stepper = createStepper<number>({ maxSteps: 1 });
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    const second = await stepper.next((previous, make) => make({ key: "b", value: 2 }));
    expect(second.isErr).toBe(true);
  });

  it("rejects invalid configuration", () => {
    expect(() => createStepper({ maxHistory: 0 })).toThrow();
    expect(() => createStepper({ maxSteps: -1 })).toThrow();
  });

  it("allows a key to be reused after its step was evicted", async () => {
    const stepper = createStepper<number>({ maxHistory: 1 });
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    await stepper.next((previous, make) => make({ key: "b", value: 2 }));

    const reused = await stepper.next((previous, make) => make({ key: "a", value: 3 }));
    expect(reused.isOk).toBe(true);
    expect(stepper.current?.value).toBe(3);
    expect(stepper.size).toBe(1);
  });

  it("returns Err for an invalid candidate", async () => {
    const stepper = createStepper<number>();
    const empty = await stepper.next(() => ({ key: "", value: 1 }));
    const missing = await stepper.next(() => ({ key: "a" }) as never);

    expect(empty.isErr).toBe(true);
    expect(missing.isErr).toBe(true);
    expect(stepper.size).toBe(0);
  });

  it("falls back to the current step for an invalid candidate", async () => {
    const stepper = createStepper<number>();
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));

    const result = await stepper.next(() => ({ key: "a" }) as never, { fallback: true });
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value.key).toBe("a");
    expect(stepper.size).toBe(1);
  });

  it("turns keyEvalFn errors into Err and accepts async approval", async () => {
    const failing = createStepper<number>({
      keyEvalFn: async () => {
        throw new Error("check failed");
      },
    });
    const rejected = await failing.next((previous, make) => make({ key: "a", value: 1 }));
    expect(rejected.isErr).toBe(true);
    expect(failing.size).toBe(0);

    const approving = createStepper<number>({ keyEvalFn: async () => true });
    const accepted = await approving.next((previous, make) => make({ key: "a", value: 1 }));
    expect(accepted.isOk).toBe(true);
    expect(approving.size).toBe(1);
  });

  it("rejects non-negative prev offsets", () => {
    const stepper = createStepper<number>();
    expect(() => stepper.prev(0)).toThrow("prev offset must be a negative integer");
    expect(() => stepper.prev(1)).toThrow("prev offset must be a negative integer");
  });

  it("counts lifetime commits for maxSteps after navigating backward", async () => {
    const stepper = createStepper<number>({ maxSteps: 2 });
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));
    await stepper.next((previous, make) => make({ key: "b", value: 2 }));
    stepper.prev().panic();

    const third = await stepper.next((previous, make) => make({ key: "c", value: 3 }));
    expect(third.isErr).toBe(true);
    expect(stepper.current?.key).toBe("a");
  });

  it("panics on a duplicate key even with fallback", async () => {
    const stepper = createStepper<number>();
    await stepper.next((previous, make) => make({ key: "a", value: 1 }));

    await expect(
      stepper.next((previous, make) => make({ key: "a", value: 2 }), { fallback: true }),
    ).rejects.toThrow("Duplicate step key");
  });

  it("rejects an invalid reconstruction and duplicate recovered keys", async () => {
    const invalid = createStepper<number>({ maxHistory: 1 });
    await invalid.next((previous, make) => make({ key: "a", value: 1 }));
    await invalid.next((previous, make) => make({ key: "b", value: 2 }));
    expect(() => invalid.prev().else(() => null as never)).toThrow("Recovered step is invalid");

    const duplicate = createStepper<number>({ maxHistory: 1 });
    await duplicate.next((previous, make) => make({ key: "a", value: 1 }));
    await duplicate.next((previous, make) => make({ key: "b", value: 2 }));
    expect(() =>
      duplicate.prev().else((_previous, make) => make({ key: "b", value: 3 })),
    ).toThrow("Duplicate step key");
  });
});
