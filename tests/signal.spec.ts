import { describe, expect, it } from "vitest";
import { createSignal } from "../src/signal";

describe("createSignal", () => {
  it("starts unfired", () => {
    const signal = createSignal();

    expect(signal.aborted).toBe(false);
  });

  it("fires once on fire()", () => {
    const signal = createSignal();
    let calls = 0;

    signal.addEventListener("abort", () => calls++);

    signal.fire();

    expect(signal.aborted).toBe(true);
    expect(calls).toBe(1);
  });

  it("subsequent fire() calls are no-ops", () => {
    const signal = createSignal();
    let calls = 0;

    signal.addEventListener("abort", () => calls++);

    signal.fire();
    signal.fire();
    signal.fire();

    expect(calls).toBe(1);
  });

  it("fires listeners registered before firing", () => {
    const signal = createSignal();
    const received: string[] = [];

    signal.addEventListener("abort", () => received.push("a"));
    signal.fire();
    signal.addEventListener("abort", () => received.push("b"));

    expect(received).toEqual(["a"]);
  });

  it("does not replay listeners registered after firing", () => {
    const signal = createSignal();
    let calls = 0;

    signal.fire();

    signal.addEventListener("abort", () => calls++);

    expect(calls).toBe(0);
  });

  it("supports removeEventListener", () => {
    const signal = createSignal();
    let calls = 0;

    const handler = () => calls++;
    signal.addEventListener("abort", handler);
    signal.removeEventListener("abort", handler);

    signal.fire();

    expect(calls).toBe(0);
  });

  it("fires through a native AbortSignal-typed reference", () => {
    const signal = createSignal();
    const native: AbortSignal = signal;
    let calls = 0;

    native.addEventListener("abort", () => calls++);
    signal.fire();

    expect(native.aborted).toBe(true);
    expect(calls).toBe(1);
  });

  it("accepts a native AbortSignal wherever a Signal is expected", () => {
    const signal = createSignal();

    const consumer = (s: AbortSignal) => {
      expect(typeof s.aborted).toBe("boolean");
      expect(typeof s.addEventListener).toBe("function");
    };

    consumer(signal);
    consumer(new AbortController().signal);
  });
});
