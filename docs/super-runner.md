# SuperRunner

`superRunner(config)` — manages several already-created `SuperPromise`s: run them in sequence, in
parallel, or as a race. `start()` runs once and returns the same result on later calls.

```ts
// Signature
superRunner<R>(config: { type: "sequence", runners: R }): SuperRunner<TupleValues<R>>;
superRunner<R>(config: { type: "all", runners: R }): SuperRunner<NamedValues<R>>;
superRunner<R, C>(config: { type: "race", count: C, runners: R }): SuperRunner<RaceValues<C, R>>;

/* Result methods */
runner.start();   // Promise<Result<Value, string>> — runs once, cached afterward
runner.abort();   // ends with Err("Aborted") and cancels active children
runner.done;      // AbortSignal — fires once when the runner finishes
```

- `sequence` — stops at the first failure; result is a tuple of values in order.
- `all` — all runners kick off at once; result is keyed by name; fails fast on first failure.
- `race` — takes the first `count` successful responses, cancels the rest.

The runner itself doesn't retry, time out, or schedule work — those belong to the child
`SuperPromise` options.

## What it is

A runner manages several already-created `SuperPromise`s. You can run them in order, in parallel,
or take the first successful completions. `start()` runs once, and calling it again returns the
same result without re-running anything.

## When to use it

- A workflow has dependent steps that should run in order.
- Several independent requests should run in parallel.
- You want the fastest successful responses and are happy to cancel the rest.
- You need one `abort()` to cancel all active children.

To schedule many tasks across runners, pass a shared [taskGroup](task-group.md) to the child
`SuperPromise`s. The runner itself doesn't take a group.

## How to use it

### Sequence

Use this when steps depend on each other. It stops at the first failure.

```ts
import { superRunner, superPromise as sp } from "slang-ts";

const auth = superRunner({
  type: "sequence",
  runners: [sp(authenticate), sp(loadProfile), sp(loadDashboard)],
});

const ordered = await auth.start();
// Ok([authenticatedUser, profile, dashboard])
```

On success, the result wraps a tuple of the runners' values in order. If any step fails, the runner
returns that `Err` and doesn't start the rest.

### All

All runners kick off at once, and the result is keyed by name. You set it up as configuration, and
the runner returns one `Result`:

```ts
const parallel = superRunner({
  type: "all",
  runners: {
    user: sp(getUser),
    posts: sp(getPosts),
    settings: sp(getSettings),
  },
});

const combined = await parallel.start(); // Ok({ user, posts, settings })
```

Without it, plain `Promise.all` rejects on the first failure, but the other requests keep running.
Cancelling them means owning a controller and a `catch`:

```ts
async function loadDashboard() {
  const controller = new AbortController();
  try {
    const [user, posts] = await Promise.all([
      fetch("/api/user", { signal: controller.signal }).then((r) => r.json()),
      fetch("/api/posts", { signal: controller.signal }).then((r) => r.json()),
    ]);
    return { user, posts };
  } catch (error) {
    controller.abort();
    throw error;
  }
}
```

`all` fails fast on the first failure and aborts the remaining children.

### Race

This takes the first successful responses, then cancels the rest.

```ts
const first = superRunner({
  type: "race",
  count: 1,
  runners: {
    primary: sp(fetchPrimary),
    backup: sp(fetchBackup),
    cache: sp(fetchCache),
  },
});

const winner = await first.start(); // Ok({ cache: ... }) or whichever won
```

With `count: 1`, the result is a single-winner object. With a larger `count`, it's a partial object
of the successful winners. If not enough runners succeed, the runner returns `Err`.

### Cancel everything

```ts
parallel.abort(); // cancels all active children
```

## Technical Notes

- `race` needs `count >= 1`. If no runner succeeds, it returns `Err("All runners failed")`. If some
  succeed but fewer than `count`, it returns `Err("Not enough runners succeeded")`.
- `start()` only runs once, and nothing runs until you call it.
- `abort()` ends the runner with `Err("Aborted")` and cancels active children. `done` fires once
  when the runner finishes.
- The runner doesn't retry, time out, or schedule work itself. Those belong to the child
  `SuperPromise` options.

## See also

- [SuperPromise](super-promise.md)
- [taskGroup](task-group.md)
- [Signal](signal.md)
- [Channel](channel.md)
