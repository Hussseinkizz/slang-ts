import { println } from "./println";

/** Event published on a Channel. */
export type ChannelEvent = {
  topic: string;
  data: unknown;
};

/** Subscriber handler receiving published events. */
export type ChannelSubscriber = (event: ChannelEvent) => void;

/** Event communication between independent parts of an application. */
export type Channel = {
  /** Immediately publishes an event to subscribers of its topic. */
  send(event: ChannelEvent): void;
  /**
   * Subscribes to events of a specific topic.
   * Returns an unsubscribe function; after calling it, no further events are received.
   */
  subscribe(filter: { topic: string }, handler: ChannelSubscriber): () => void;
  /** Publishes an event when a signal fires. Accepts any compatible lifecycle signal. */
  when(config: { signal: AbortSignal; topic: string; data: unknown }): void;
};

/**
 * Creates a Channel — completely independent of SuperPromise/SuperRunner.
 *
 * @example
 * const channel = createChannel();
 *
 * const unsubscribe = channel.subscribe({ topic: "user.created" }, event => {
 *   println(event.data);
 * });
 *
 * channel.send({ topic: "user.created", data: user });
 * unsubscribe(); // stop receiving events
 */
export function createChannel(): Channel {
  const byTopic = new Map<string, Set<ChannelSubscriber>>();

  const send = (event: ChannelEvent): void => {
    const handlers = byTopic.get(event.topic);
    if (handlers === undefined) return;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        // One throwing subscriber must not break the others.
        println("channel subscriber threw:", error);
      }
    }
  };

  const subscribe = (
    filter: { topic: string },
    handler: ChannelSubscriber,
  ): (() => void) => {
    let handlers = byTopic.get(filter.topic);
    if (handlers === undefined) {
      handlers = new Set();
      byTopic.set(filter.topic, handlers);
    }
    handlers.add(handler);

    return () => {
      const set = byTopic.get(filter.topic);
      if (set !== undefined) set.delete(handler);
    };
  };

  const when = (config: { signal: AbortSignal; topic: string; data: unknown }): void => {
    if (config.signal.aborted) {
      send({ topic: config.topic, data: config.data });
      return;
    }
    config.signal.addEventListener(
      "abort",
      () => send({ topic: config.topic, data: config.data }),
      { once: true },
    );
  };

  return { send, subscribe, when };
}
