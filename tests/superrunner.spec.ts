import { describe, expect, it } from "vitest";
import { superPromise, superRunner } from "../src";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("superRunner — sequence", () => {
  it("executes runners in order and returns a positional tuple", async () => {
    const order: string[] = [];

    const runner = superRunner({
      type: "sequence",
      runners: [
        superPromise(async () => {
          order.push("auth");
          return "a";
        }),
        superPromise(async () => {
          order.push("profile");
          return "p";
        }),
      ],
    });

    const result = await runner.start();

    expect(order).toEqual(["auth", "profile"]);
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual(["a", "p"]);
  });

  it("stops at the first failure; remaining runners never start", async () => {
    const order: string[] = [];

    const runner = superRunner({
      type: "sequence",
      runners: [
        superPromise(async () => {
          order.push("first");
          throw new Error("fail here");
        }),
        superPromise(async () => {
          order.push("second");
          return 2;
        }),
      ],
    });

    const result = await runner.start();

    expect(order).toEqual(["first"]);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("fail here");
  });

  it("settles Ok with an empty tuple for no runners", async () => {
    const runner = superRunner({ type: "sequence", runners: [] });
    const result = await runner.start();

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual([]);
  });
});

describe("superRunner — all", () => {
  it("runs children concurrently and returns a named object", async () => {
    const runner = superRunner({
      type: "all",
      runners: {
        user: superPromise(async () => "u"),
        posts: superPromise(async () => ["p1", "p2"]),
        settings: superPromise(async () => ({ theme: "dark" })),
      },
    });

    const result = await runner.start();

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.value).toEqual({
        user: "u",
        posts: ["p1", "p2"],
        settings: { theme: "dark" },
      });
    }
  });

  it("runs children concurrently (no order guarantee)", async () => {
    let slowDone = false;

    const runner = superRunner({
      type: "all",
      runners: {
        slow: superPromise(async () => {
          await tick(30);
          slowDone = true;
          return 1;
        }),
        fast: superPromise(async () => {
          await tick(5);
          return 2;
        }),
      },
    });

    await runner.start();
    expect(slowDone).toBe(true);
  });

  it("fails fast on the first failure and aborts remaining children", async () => {
    const aborted: string[] = [];

    const runner = superRunner({
      type: "all",
      runners: {
        failing: superPromise(() => {
          throw new Error("kaboom");
        }),
        slow: superPromise(
          (signal) =>
            new Promise((resolve) => {
              signal.addEventListener("abort", () => {
                aborted.push("slow");
                resolve(0);
              });
            }),
        ),
      },
    });

    const result = await runner.start();

    expect(aborted).toEqual(["slow"]);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("kaboom");
  });

  it("settles Ok with an empty object for no runners", async () => {
    const runner = superRunner({ type: "all", runners: {} });
    const result = await runner.start();

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({});
  });
});

describe("superRunner — race", () => {
  it("count: 1 settles with the first successful completion", async () => {
    const runner = superRunner({
      type: "race",
      count: 1,
      runners: {
        cache: superPromise(async () => {
          await tick(5);
          return "cached";
        }),
        network: superPromise(async () => {
          await tick(30);
          return "fresh";
        }),
      },
    });

    const result = await runner.start();

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({ cache: "cached" });
  });

  it("count: n settles with the first n successful completions and aborts the rest", async () => {
    const aborted: string[] = [];

    const runner = superRunner({
      type: "race",
      count: 2,
      runners: {
        a: superPromise(async () => {
          await tick(5);
          return "a";
        }),
        b: superPromise(async () => {
          await tick(10);
          return "b";
        }),
        c: superPromise(
          (signal) =>
            new Promise((resolve) => {
              signal.addEventListener("abort", () => {
                aborted.push("c");
                resolve(0);
              });
            }),
        ),
      },
    });

    const result = await runner.start();

    expect(aborted).toEqual(["c"]);
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({ a: "a", b: "b" });
  });

  it("failures do not consume winner slots", async () => {
    const runner = superRunner({
      type: "race",
      count: 1,
      runners: {
        broken: superPromise(() => {
          throw new Error("down");
        }),
        backup: superPromise(async () => {
          await tick(5);
          return "recovered";
        }),
      },
    });

    const result = await runner.start();

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toEqual({ backup: "recovered" });
  });

  it("settles Err('All runners failed') when every runner fails", async () => {
    const runner = superRunner({
      type: "race",
      count: 1,
      runners: {
        a: superPromise(() => {
          throw new Error("a down");
        }),
        b: superPromise(() => {
          throw new Error("b down");
        }),
      },
    });

    const result = await runner.start();

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("All runners failed");
  });

  it("settles Err('Not enough runners succeeded') for partial winners", async () => {
    const runner = superRunner({
      type: "race",
      count: 2,
      runners: {
        a: superPromise(async () => {
          await tick(5);
          return "a";
        }),
        b: superPromise(() => {
          throw new Error("b down");
        }),
      },
    });

    const result = await runner.start();

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Not enough runners succeeded");
  });

  it("throws when count is less than 1", () => {
    expect(() =>
      superRunner({ type: "race", count: 0, runners: { a: superPromise(() => 1) } }),
    ).toThrow(/count/);
  });
});

describe("superRunner — lifecycle", () => {
  it("start() is idempotent — same result, no re-execution", async () => {
    let executions = 0;

    const runner = superRunner({
      type: "all",
      runners: {
        a: superPromise(async () => {
          executions += 1;
          return 1;
        }),
      },
    });

    const first = await runner.start();
    const second = await runner.start();

    expect(executions).toBe(1);
    expect(second).toBe(first);
    if (first.isOk && second.isOk) {
      expect(second.value).toEqual(first.value);
    }
  });

  it("abort() before start settles Err('Aborted') and children never run", async () => {
    let executed = false;

    const runner = superRunner({
      type: "all",
      runners: {
        a: superPromise(async () => {
          executed = true;
          return 1;
        }),
      },
    });

    runner.abort();
    const result = await runner.start();

    expect(executed).toBe(false);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("abort() cancels in-flight children", async () => {
    const aborted: string[] = [];

    const runner = superRunner({
      type: "all",
      runners: {
        a: superPromise(
          (signal) =>
            new Promise((resolve) => {
              signal.addEventListener("abort", () => {
                aborted.push("a");
                resolve(0);
              });
            }),
        ),
        b: superPromise(
          (signal) =>
            new Promise((resolve) => {
              signal.addEventListener("abort", () => {
                aborted.push("b");
                resolve(0);
              });
            }),
        ),
      },
    });

    const pending = runner.start();
    await tick(10);
    runner.abort();
    const result = await pending;

    expect(aborted).toEqual(["a", "b"]);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("fires done on settlement", async () => {
    const runner = superRunner({
      type: "all",
      runners: { a: superPromise(() => 1) },
    });

    await runner.start();
    expect(runner.done.aborted).toBe(true);
  });

  it("runner.done can drive a deferred task (activation via hook)", async () => {
    const order: string[] = [];

    const runner = superRunner({
      type: "sequence",
      runners: [
        superPromise(async () => {
          order.push("runner");
          return 1;
        }),
      ],
    });

    const after = superPromise(async () => {
      order.push("after");
      return 2;
    }, { defer: runner.done });

    const result = await after;

    expect(order).toEqual(["runner", "after"]);
    expect(result.isOk).toBe(true);
  });
});
