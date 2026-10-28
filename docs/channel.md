# Channel

A channel lets parts of an app that do not know each other talk: one side publishes, another
listens.

## What it is

A channel is a small in-process event bus. Subscribers listen to a topic; publishers send events to
that topic.

## When to use it

- A feature needs to announce something without importing the code that reacts to it.
- Several parts of the UI or service care about the same event.
- You want to publish when a task or workflow finishes.

For request/response, call the function directly. For cross-process messaging, use a real message
broker. A channel is for one process.

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

Publish when a trigger goes off or a task finishes:

```ts
channel.when({
  signal: workflow.done,
  topic: "workflow.completed",
  data: { workflowId },
});
```

## Notes

- `send` is synchronous. Subscribers run before `send` returns.
- Topics are exact strings. There is no wildcard or hierarchy.
- `subscribe` returns an unsubscribe function. Call it when the listener is no longer needed.
- Sending to a topic with no subscribers is a no-op.
- A throwing subscriber does not stop the others. The error is reported through
  [println](logging.md), so it is silent in production unless a logger is wired.
- `when` sends immediately if the signal has already fired.
- Events are not replayed. A subscriber added after an event misses it.
- `data` is `unknown`; the publisher and subscriber share the shape by convention.

## See also

- [Signal](signal.md)
- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
- [println](logging.md)
