import { describe, expect, it } from "vitest";
import { superPromise, createSignal } from "../src";
import { Ok, Err } from "../src/result";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("superPromise — construction and final state", () => {
  it("resolves to Ok(value) on success", async () => {
    const result = await superPromise(() => 42);

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(42);
  });

  it("supports the long form superPromise()", async () => {
    const result = await superPromise(() => "long");

    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe("long");
  });

  it("resolves to Err(message) when executor throws an Error", async () => {
    const result = await superPromise(() => {
      throw new Error("boom");
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("boom");
  });

  it("normalizes non-Error throws to Err(String(value))", async () => {
    const result = await superPromise(() => {
      throw { custom: "thing" };
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("[object Object]");
  });

  it("normalizes async rejections", async () => {
    const result = await superPromise(async () => {
      throw new Error("async boom");
    });

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("async boom");
  });

  it("unwraps executor Results instead of nesting", async () => {
    const ok = await superPromise(() => Ok(5));
    expect(ok.isOk).toBe(true);
    if (ok.isOk) expect(ok.value).toBe(5);

    const err = await superPromise(() => Err("inner failure"));
    expect(err.isErr).toBe(true);
    if (err.isErr) expect(err.error).toBe("inner failure");
  });

  it("passes an AbortSignal to the executor", async () => {
    let received: AbortSignal | undefined;
    const task = superPromise((signal) => {
      received = signal;
      return 1;
    });

    await task;
    expect(received).toBeDefined();
    expect(received!.aborted).toBe(false);
  });

  it("never rejects — .catch is effectively dead", async () => {
    const task = superPromise(() => {
      throw new Error("captured");
    });
    let catchCalls = 0;

    const result = await task.catch(() => {
      catchCalls += 1;
      return Err("from catch");
    });

    expect(catchCalls).toBe(0);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("captured");
  });

  it(".then receives the Result", async () => {
    const seen: unknown[] = [];
    const task = superPromise(() => 7);

    await task.then((result) => {
      seen.push(result);
    });

    expect(seen).toHaveLength(1);
    expect((seen[0] as { isOk: boolean }).isOk).toBe(true);
  });

  it(".finally runs natively", async () => {
    let finallyCalls = 0;
    const task = superPromise(() => 1);

    await task.finally(() => {
      finallyCalls += 1;
    });

    expect(finallyCalls).toBe(1);
  });
});

describe("superPromise — manual control", () => {
  it("resolve() settles with Ok", async () => {
    const task = superPromise<number>();
    task.resolve(100);

    const result = await task;
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(100);
  });

  it("reject() settles with normalized Err", async () => {
    const task = superPromise<number>();
    task.reject(new Error("manual failure"));

    const result = await task;
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("manual failure");
  });

  it("first settlement wins", async () => {
    const task = superPromise<number>();
    task.resolve(1);
    task.reject(new Error("late"));

    const result = await task;
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(1);
  });
});

describe("superPromise — abort", () => {
  it("abort() before consumption settles with Err('Aborted')", async () => {
    const task = superPromise(async () => "never runs");
    task.abort();

    const result = await task;
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("abort() cancels an in-flight operation", async () => {
    let sawAbort = false;
    const task = superPromise(
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            sawAbort = true;
            resolve(0);
          });
        }),
    );

    const pending = task.then();
    await tick(10);
    task.abort();
    const result = await pending;

    expect(sawAbort).toBe(true);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("abort() after settlement is a no-op", async () => {
    const task = superPromise(() => 1);
    const result = await task;
    task.abort();

    expect(result.isOk).toBe(true);
  });

  it("fires done on settlement", async () => {
    const task = superPromise(() => 1);
    await task;

    expect(task.done.aborted).toBe(true);
  });
});

describe("superPromise — done", () => {
  it("fires done on success", async () => {
    const task = superPromise(() => 1);
    await task;
    expect(task.done.aborted).toBe(true);
  });

  it("fires done on failure", async () => {
    const task = superPromise(() => {
      throw new Error("fail");
    });
    await task;
    expect(task.done.aborted).toBe(true);
  });
});

describe("superPromise — defer", () => {
  it("waits for the signal before executing", async () => {
    const signal = createSignal();
    let executed = false;

    const task = superPromise(async () => {
      executed = true;
      return 1;
    }, { defer: signal });

    const pending = task.then();
    await tick(10);
    expect(executed).toBe(false);

    signal.fire();
    const result = await pending;
    expect(executed).toBe(true);
    expect(result.isOk).toBe(true);
  });

  it("executes immediately when the signal already fired", async () => {
    const signal = createSignal();
    signal.fire();

    const result = await superPromise(() => 1, { defer: signal });
    expect(result.isOk).toBe(true);
  });

  it("activates deferred SuperPromise sources (dependency chain)", async () => {
    const order: string[] = [];

    const config = superPromise(async () => {
      order.push("config");
      return 1;
    });

    const user = superPromise(async () => {
      order.push("user");
      return 2;
    }, { defer: config.done });

    const result = await user;

    expect(order).toEqual(["config", "user"]);
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(2);
  });

  it("abort during defer wait settles with Err('Aborted')", async () => {
    const signal = createSignal();
    const task = superPromise(async () => "never", { defer: signal });

    const pending = task.then();
    task.abort();
    const result = await pending;

    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("accepts a native AbortSignal as a go-signal", async () => {
    const controller = new AbortController();
    let executed = false;

    const task = superPromise(async () => {
      executed = true;
      return 1;
    }, { defer: controller.signal });

    const pending = task.then();
    await tick(10);
    expect(executed).toBe(false);

    controller.abort();
    const result = await pending;

    expect(executed).toBe(true);
    expect(result.isOk).toBe(true);
  });
});

describe("superPromise — delay", () => {
  it("delays initial execution", async () => {
    let executedAt = 0;
    const start = Date.now();

    const task = superPromise(async () => {
      executedAt = Date.now();
      return 1;
    }, { delay: 50 });

    await task;
    expect(executedAt - start).toBeGreaterThanOrEqual(40);
  });

  it("abort during delay settles with Err('Aborted')", async () => {
    const task = superPromise(async () => "never", { delay: 1000 });
    const pending = task.then();
    task.abort();

    const result = await pending;
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });
});

describe("superPromise — timeout", () => {
  it("settles with Err('Timed out') and cancels the operation", async () => {
    let sawAbort = false;
    const task = superPromise(
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            sawAbort = true;
            resolve(0);
          });
        }),
      { timeout: 30 },
    );

    const result = await task;
    expect(sawAbort).toBe(true);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Timed out");
  });

  it("does not retry timeouts", async () => {
    let attempts = 0;
    const task = superPromise(
      (signal) => {
        attempts += 1;
        return new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(0));
        });
      },
      { timeout: 30, retry: 3 },
    );

    await task;
    expect(attempts).toBe(1);
  });

  it("clears the timer when the operation completes first", async () => {
    const task = superPromise(() => "fast", { timeout: 5000 });
    const result = await task;
    expect(result.isOk).toBe(true);
  });
});

describe("superPromise — retry", () => {
  it("retry: n means n retries after the first attempt (n+1 total)", async () => {
    let attempts = 0;
    const task = superPromise(() => {
      attempts += 1;
      if (attempts < 3) throw new Error("flaky");
      return "recovered";
    }, { retry: 3 });

    const result = await task;
    expect(attempts).toBe(3);
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe("recovered");
  });

  it("settles with Err after exhausting retries", async () => {
    let attempts = 0;
    const task = superPromise(() => {
      attempts += 1;
      throw new Error("always fails");
    }, { retry: 2 });

    const result = await task;
    expect(attempts).toBe(3);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("always fails");
  });

  it("retry: 0 means a single attempt", async () => {
    let attempts = 0;
    const task = superPromise(() => {
      attempts += 1;
      throw new Error("once");
    }, { retry: 0 });

    await task;
    expect(attempts).toBe(1);
  });

  it("does not retry explicit aborts", async () => {
    let attempts = 0;
    const task = superPromise(
      (signal) => {
        attempts += 1;
        return new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve(0));
        });
      },
      { retry: 3 },
    );

    const pending = task.then();
    await tick(10);
    task.abort();
    const result = await pending;

    expect(attempts).toBe(1);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("applies delay between retries", async () => {
    const timestamps: number[] = [];
    let attempts = 0;
    const task = superPromise(async () => {
      attempts += 1;
      timestamps.push(Date.now());
      if (attempts < 2) throw new Error("retry me");
      return 1;
    }, { delay: 50, retry: 1 });

    await task;
    expect(attempts).toBe(2);
    expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(40);
  });
});

describe("superPromise — retryUntil", () => {
  it("retries until the stop signal fires between attempts", async () => {
    const stop = createSignal();
    let attempts = 0;
    let resolved = false;

    const task = superPromise(() => {
      attempts += 1;
      throw new Error("not yet");
    }, { retryUntil: { signal: stop, delay: 5 } });

    const pending = task.then().then((r) => {
      resolved = true;
      return r;
    });
    await tick(15);
    stop.fire();

    const result = await pending;
    expect(resolved).toBe(true);
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Stopped");
  });

  it("cancels the in-flight attempt and settles Err('Stopped') when the stop fires mid-attempt", async () => {
    const stop = createSignal();
    let attemptAborted = false;
    let resolved = false;

    const task = superPromise(
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            attemptAborted = true;
            resolve(0);
          });
        }),
      { retryUntil: { signal: stop, delay: 5 } },
    );

    const pending = task.then().then((r) => {
      resolved = true;
      return r;
    });
    await tick(10);
    stop.fire();

    const result = await pending;
    expect(attemptAborted).toBe(true);
    expect(resolved).toBe(true);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Stopped");
  });

  it("succeeds when an attempt finally completes", async () => {
    const stop = createSignal();
    let attempts = 0;

    const task = superPromise(() => {
      attempts += 1;
      if (attempts < 3) throw new Error("keep trying");
      return "done";
    }, { retryUntil: { signal: stop, delay: 5 } });

    const result = await task;
    expect(attempts).toBe(3);
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe("done");
  });

  it("settles Err('Stopped') without executing when the stop already fired", async () => {
    const stop = createSignal();
    stop.fire();
    let executed = false;

    const task = superPromise(() => {
      executed = true;
      return 1;
    }, { retryUntil: { signal: stop } });

    const result = await task;
    expect(executed).toBe(false);
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Stopped");
  });

  it("settles Err('Aborted') on explicit abort", async () => {
    const stop = createSignal();
    const task = superPromise(() => {
      throw new Error("flaky");
    }, { retryUntil: { signal: stop, delay: 5 } });

    const pending = task.then();
    await tick(10);
    task.abort();

    const result = await pending;
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });

  it("overrides normal retry and delay", async () => {
    const stop = createSignal();
    let attempts = 0;
    const order: string[] = [];

    const task = superPromise(async () => {
      attempts += 1;
      order.push(`attempt-${attempts}`);
      throw new Error("always");
    }, { delay: 10, retry: 1, retryUntil: { signal: stop, delay: 5 } });

    const pending = task.then();
    await tick(30);
    stop.fire();
    await pending;

    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});

describe("superPromise — tap", () => {
  it("passes the successful value through", async () => {
    const seen: number[] = [];
    const task = superPromise(() => 42).tap((value) => {
      seen.push(value);
    });

    const result = await task;
    expect(seen).toEqual([42]);
    expect(result.isOk).toBe(true);
    if (result.isOk) expect(result.value).toBe(42);
  });

  it("passes failures through without calling the callback", async () => {
    let calls = 0;
    const task = superPromise(() => {
      throw new Error("nope");
    }).tap(() => {
      calls += 1;
    });

    const result = await task;
    expect(calls).toBe(0);
    expect(result.isErr).toBe(true);
  });

  it("settles with Err when the callback throws", async () => {
    const task = superPromise(() => 1).tap(() => {
      throw new Error("tap exploded");
    });

    const result = await task;
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("tap exploded");
  });

  it("supports async callbacks", async () => {
    const task = superPromise(() => 1).tap(async () => {
      await tick(5);
    });

    const result = await task;
    expect(result.isOk).toBe(true);
  });

  it("works in a chain", async () => {
    const trail: string[] = [];
    const task = superPromise(() => "start")
      .tap(() => trail.push("first"))
      .tap(() => trail.push("second"));

    await task;
    expect(trail).toEqual(["first", "second"]);
  });
});

describe("superPromise — lazy activation", () => {
  it("does not execute until consumed", async () => {
    let executed = false;
    const task = superPromise(async () => {
      executed = true;
      return 1;
    });

    await tick(10);
    expect(executed).toBe(false);

    await task;
    expect(executed).toBe(true);
  });

  it("consumption after abort still settles", async () => {
    const task = superPromise(() => 1);
    task.abort();

    const result = await task;
    expect(result.isErr).toBe(true);
    if (result.isErr) expect(result.error).toBe("Aborted");
  });
});
