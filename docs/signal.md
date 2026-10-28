# Signal

A signal is a trigger that fires once and stays fired. Flip it when you are ready, and anything
waiting on it reacts.

## What it is

`createSignal()` returns an `AbortSignal` with a `fire()` method. It is interchangeable with the
platform's `AbortSignal`, so you can hand it to anything that already accepts one.

Use it to gate work on a lifecycle event: config loaded, auth ready, a task finished.

## When to use it

- A task should not start until another one finishes.
- You want to publish an event when a lifecycle completes.
- You need a one-shot switch that listeners can wait on.

## How to use it

```ts
import { createSignal, println } from "slang-ts";

const ready = createSignal();

ready.addEventListener("abort", () => println("ready!")); // fires when the trigger goes off
ready.fire();                                             // flip it

println(ready.aborted); // true
```

Gate work or publish an event:

```ts
const task = superPromise(loadUser, { defer: ready }); // starts only once ready fires

channel.when({
  signal: task.done,   // task finished, success or not
  topic: "user.loaded",
  data: { id: userId },
});
```

`superPromise` accepts signals for `defer` and `retryUntil`; `channel.when` accepts any compatible
signal.

## Notes

- Firing is one-way. A signal cannot be reset or reused.
- `fire()` is idempotent. Later calls do nothing.
- Listeners added after the signal fired are not replayed. Check `signal.aborted` if you need to
  handle an already-fired signal.
- A signal is an `AbortSignal`, so `aborted` and `addEventListener("abort", ...)` behave normally.
- `task.done` fires on success or failure, once the task reaches a terminal state.
- Do not use a signal as a general event bus. Use [Channel](channel.md) for messages.

## See also

- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
- [Channel](channel.md)
- [taskGroup](task-group.md)
