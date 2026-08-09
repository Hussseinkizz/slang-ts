import { describe, expect, it } from "vitest";
import { createChannel, createSignal, superPromise, superRunner } from "../src";

describe("createChannel — send/sub", () => {
  it("delivers events to subscribers of the topic", () => {
    const channel = createChannel();
    const received: unknown[] = [];

    channel.subscribe({ topic: "user.created" }, (event) => {
      received.push(event);
    });

    channel.send({ topic: "user.created", data: { id: 1 } });

    expect(received).toEqual([{ topic: "user.created", data: { id: 1 } }]);
  });

  it("does not deliver events of other topics", () => {
    const channel = createChannel();
    const received: unknown[] = [];

    channel.subscribe({ topic: "user.created" }, (event) => {
      received.push(event);
    });

    channel.send({ topic: "user.deleted", data: { id: 2 } });
    channel.send({ topic: "user.created", data: { id: 1 } });

    expect(received).toEqual([{ topic: "user.created", data: { id: 1 } }]);
  });

  it("delivers to every subscriber of the topic", () => {
    const channel = createChannel();
    const first: unknown[] = [];
    const second: unknown[] = [];

    channel.subscribe({ topic: "t" }, (e) => first.push(e.data));
    channel.subscribe({ topic: "t" }, (e) => second.push(e.data));

    channel.send({ topic: "t", data: 42 });

    expect(first).toEqual([42]);
    expect(second).toEqual([42]);
  });

  it("unsubscribe stops delivery", () => {
    const channel = createChannel();
    const received: unknown[] = [];

    const unsubscribe = channel.subscribe({ topic: "t" }, (event) => {
      received.push(event.data);
    });

    channel.send({ topic: "t", data: 1 });
    unsubscribe();
    channel.send({ topic: "t", data: 2 });

    expect(received).toEqual([1]);
  });

  it("one throwing subscriber does not break the others", () => {
    const channel = createChannel();
    const received: unknown[] = [];

    channel.subscribe({ topic: "t" }, () => {
      throw new Error("subscriber bug");
    });
    channel.subscribe({ topic: "t" }, (event) => received.push(event.data));

    expect(() => channel.send({ topic: "t", data: 1 })).not.toThrow();
    expect(received).toEqual([1]);
  });
});

describe("createChannel — when", () => {
  it("publishes an event when the signal fires", () => {
    const channel = createChannel();
    const signal = createSignal();
    const received: unknown[] = [];

    channel.subscribe({ topic: "task.completed" }, (event) => received.push(event));
    channel.when({ signal, topic: "task.completed", data: { id: 7 } });

    expect(received).toEqual([]);

    signal.fire();
    expect(received).toEqual([{ topic: "task.completed", data: { id: 7 } }]);
  });

  it("publishes immediately when the signal already fired", () => {
    const channel = createChannel();
    const signal = createSignal();
    signal.fire();
    const received: unknown[] = [];

    channel.subscribe({ topic: "t" }, (event) => received.push(event.data));
    channel.when({ signal, topic: "t", data: "already" });

    expect(received).toEqual(["already"]);
  });

  it("accepts a SuperPromise done signal", async () => {
    const channel = createChannel();
    const task = superPromise(() => "result");
    const received: unknown[] = [];

    channel.subscribe({ topic: "task.done" }, (event) => received.push(event.data));
    channel.when({ signal: task.done, topic: "task.done", data: { id: 1 } });

    await task;
    expect(received).toEqual([{ id: 1 }]);
  });

  it("accepts a native AbortSignal", () => {
    const channel = createChannel();
    const controller = new AbortController();
    const received: unknown[] = [];

    channel.subscribe({ topic: "t" }, (event) => received.push(event.data));
    channel.when({ signal: controller.signal, topic: "t", data: "native" });

    controller.abort();
    expect(received).toEqual(["native"]);
  });

  it("works with a SuperRunner done signal", async () => {
    const channel = createChannel();
    const runner = superRunner({
      type: "all",
      runners: { a: superPromise(() => 1) },
    });
    const received: unknown[] = [];

    channel.subscribe({ topic: "workflow.completed" }, (event) => received.push(event));
    channel.when({
      signal: runner.done,
      topic: "workflow.completed",
      data: { workflowId: 99 },
    });

    await runner.start();
    expect(received).toEqual([
      { topic: "workflow.completed", data: { workflowId: 99 } },
    ]);
  });
});
