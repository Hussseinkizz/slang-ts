# Signal

`createSignal()` — a trigger that fires once and stays fired. Fire it when you're ready, and
anything waiting on it reacts.

```ts
// Signature
createSignal(): Signal;

/* Signal — an AbortSignal plus fire() */
signal.fire();      // fires once; later calls do nothing
signal.aborted;     // true after firing
signal.addEventListener("abort", listener); // works like a native AbortSignal
```

`createSignal()` returns an `AbortSignal` with a `fire()` method, so you can hand it to anything
that accepts an `AbortSignal` (e.g. `superPromise`'s `defer` or `retryUntil`). Listeners aren't
replayed after firing.

## What it is

`createSignal()` gives you an `AbortSignal` with a `fire()` method. You can use it in place of the
platform's `AbortSignal`, so you can hand it to anything that already accepts one.

Use it to hold work back until a lifecycle event: config loaded, auth ready, a task finished.

## When to use it

- A task shouldn't start until another one finishes.
- You want to publish an event when a lifecycle completes.
- You need a switch that fires once and that listeners can wait on.

## How to use it

```ts
import { createSignal, println } from "slang-ts";

const ready = createSignal();

ready.addEventListener("abort", () => println("ready!")); // fires when the trigger goes off
ready.fire();                                             // fire it

println(ready.aborted); // true
```

Use it to hold work back or publish an event:

```ts
const task = superPromise(loadUser, { defer: ready }); // starts only once ready fires

channel.when({
  signal: task.done,   // task finished, success or not
  topic: "user.loaded",
  data: { id: userId },
});
```

`superPromise` takes signals for `defer` and `retryUntil`, and `channel.when` takes any compatible
signal.

## Technical Notes

- Firing is one-way. You can't reset or reuse a signal.
- Calling `fire()` again does nothing.
- Listeners added after the signal fired don't get replayed. Check `signal.aborted` if you need to
  handle an already-fired signal.
- A signal is an `AbortSignal`, so `aborted` and `addEventListener("abort", ...)` behave normally.
- `task.done` fires on success or failure, once the task finishes.
- Don't use a signal as a general event bus. Use [Channel](channel.md) for messages.

## See also

- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
- [Channel](channel.md)
- [taskGroup](task-group.md)
