import { describe, expect, it, vi } from "vitest";
import { superPromise, superRunner, taskGroup } from "../index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("taskGroup", () => {
  it("limits concurrency across tasks", async () => {
    const group = taskGroup("g", { concurrency: 2 });
    let active = 0;
    let peak = 0;

    const make = () =>
      superPromise(
        async () => {
          active += 1;
          peak = Math.max(peak, active);
          await delay(10);
          active -= 1;
          return "done";
        },
        { group },
      );

    await Promise.all([make(), make(), make(), make()]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("shares concurrency across multiple SuperRunners", async () => {
    const group = taskGroup("g", { concurrency: 1 });
    let active = 0;
    let peak = 0;

    const make = () =>
      superPromise(
        async () => {
          active += 1;
          peak = Math.max(peak, active);
          await delay(10);
          active -= 1;
          return "done";
        },
        { group },
      );

    const first = superRunner({ type: "all", runners: { a: make(), b: make() } });
    const second = superRunner({ type: "all", runners: { c: make(), d: make() } });

    await Promise.all([first.start(), second.start()]);
    expect(peak).toBe(1);
  });

  it("spaces starts with throttle", async () => {
    const group = taskGroup("g", { concurrency: 10, throttle: 20 });
    const starts: number[] = [];

    const make = () =>
      superPromise(
        async () => {
          starts.push(Date.now());
          return 1;
        },
        { group },
      );

    await Promise.all([make(), make(), make()]);
    expect(starts).toHaveLength(3);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(15);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(15);
  });

  it("rejects invalid configuration", () => {
    expect(() => taskGroup("g", { concurrency: 0 })).toThrow();
    expect(() => taskGroup("g", { throttle: -1 })).toThrow();
  });

  it("reacquires admission for a retry", async () => {
    const group = taskGroup("g", { concurrency: 1 });
    const acquire = vi.spyOn(group, "acquire");
    let attempts = 0;

    const task = superPromise(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("first attempt fails");
        return "done";
      },
      { group, retry: 1 },
    );

    await expect(task).resolves.toMatchObject({ isOk: true, value: "done" });
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it("waits for a manual release before admitting the next task", async () => {
    const group = taskGroup("g", { concurrency: 1 });
    const firstRelease = await group.acquire();
    let secondGranted = false;

    const second = group.acquire().then((release) => {
      secondGranted = true;
      return release;
    });

    await Promise.resolve();
    expect(secondGranted).toBe(false);

    firstRelease();
    const secondRelease = await second;
    expect(secondGranted).toBe(true);
    secondRelease();
  });

  it("ignores duplicate release calls", async () => {
    const group = taskGroup("g", { concurrency: 1 });
    const firstRelease = await group.acquire();

    firstRelease();
    firstRelease();

    const secondRelease = await group.acquire();
    let thirdGranted = false;
    const third = group.acquire().then((release) => {
      thirdGranted = true;
      return release;
    });

    await Promise.resolve();
    expect(thirdGranted).toBe(false);

    secondRelease();
    const thirdRelease = await third;
    expect(thirdGranted).toBe(true);
    thirdRelease();
  });
});
