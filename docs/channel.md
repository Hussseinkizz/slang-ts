# Channel

`createChannel()`: a small in-process event bus. One side publishes, the other listens.

```ts
// Signature
createChannel(): Channel;

/* Channel methods */
channel.subscribe(topic, handler);   // unsubscribe(): listener for exact-topic events
channel.send(topic, data);           // synchronous; subscribers run before send returns
channel.when({ signal, topic, data });   // publishes when a signal fires
```

Topics are exact strings (no wildcards). `subscribe` returns an unsubscribe function. Sending to a
topic with no subscribers does nothing. Events aren't replayed: a subscriber added after an event
misses it. For cross-process messaging, use a real message broker; a channel is for one process.

## What it is

It's a small event bus inside one process. Subscribers listen to a topic, and publishers send
events to it.

## When to use it

- A feature needs to announce something without importing the code that reacts to it.
- Several parts of the UI or service care about the same event.
- You want to publish when a task or workflow finishes.

For request/response, just call the function directly. For cross-process messaging, use a real
message broker. A channel is for one process.

## How to use it

```ts
import { createChannel, println } from "slang-ts";

const channel = createChannel();

const unsubscribe = channel.subscribe({ topic: "user.created" }, (event) => {
  println("Created:", event.data);
});

channel.send({ topic: "user.created", data: { id: "123" } });
unsubscribe(); // stop listening
```

Publish when a trigger fires or a task finishes:

```ts
channel.when({
  signal: workflow.done,
  topic: "workflow.completed",
  data: { workflowId },
});
```

## Technical Notes

- `send` is synchronous. Subscribers run before `send` returns.
- Topics are exact strings. There's no wildcard or hierarchy.
- `subscribe` returns an unsubscribe function. Call it when you no longer need the listener.
- Sending to a topic with no subscribers does nothing.
- A throwing subscriber doesn't stop the others. The error goes through
  [println](logging.md), so it's silent in production unless a logger is wired.
- `when` sends immediately if the signal has already fired.
- Events aren't replayed. A subscriber added after an event misses it.
- `data` is `unknown`, so the publisher and subscriber share the shape by convention.

## See also

- [Signal](signal.md)
- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
- [println](logging.md)
