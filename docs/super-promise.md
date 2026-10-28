# SuperPromise

Native promises with execution controls: wait before starting, retry a failure, time out a hang,
cancel from outside, and a `done` signal to wire into other work.

Tasks settle into `Ok` or `Err`, so you check an outcome instead of wrapping every await in
`try`/`catch`.

## What it is

`superPromise(executor, options?)` wraps an async operation. The executor receives an `AbortSignal`
and returns a value, a `Result`, or a promise of either.

The returned task is promise-compatible. Awaiting it gives `Result<T, string>`; it does not reject
just because the executor threw.

## When to use it

- A network or database call needs a timeout, retries, or cancellation.
- You want the result as `Ok`/`Err` instead of a thrown error.
- One task should start only after another finishes.
- You want to cap concurrency or rate-limit starts across many tasks with
  [taskGroup](task-group.md).

For simple work that needs none of that, a plain promise is enough.

## How to use it

### A timeout and retries

`superPromise` takes the policy as options and settles into a `Result`:

```ts
import { superPromise, println } from "slang-ts";

type User = { name: string };

const result = await superPromise(
  async (signal) => {
    const response = await fetch("/api/user", { signal });
    if (!response.ok) throw new Error("Could not load user");
    return (await response.json()) as User;
  },
  { timeout: 5000, retry: 2 }, // 3 attempts total; timeouts are not retried
);

if (result.isOk) {
  println("User:", result.value);
} else {
  println("Failed:", result.error);
}
```

Without it, the same policy lives in the call site: a controller and timer per attempt, plus a loop
that decides what may be retried.

```ts
type User = { name: string };

async function loadUserWithRetry(url: string, attempts = 3): Promise<User> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Could not load user");
      return (await response.json()) as User;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Timed out");
      if (attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Could not load user");
}
```

The task also supports `.then`; the callback receives the same `Result`.

### Wait for something else first

`defer` holds execution until a signal fires. Chain operations so the next starts only when the
previous is done:

```ts
const config = superPromise(loadConfig);
const user = superPromise(loadUser, { defer: config.done });

const result = await user; // config runs first, then user
```

### Cancel or keep retrying

```ts
import { createSignal, superPromise } from "slang-ts";

const task = superPromise(fetchData);
task.abort();
const outcome = await task; // Err("Aborted")

const stop = createSignal();
const retrying = superPromise(fetchData, {
  retryUntil: { signal: stop, delay: 2000 }, // keep trying until stop fires
});

retrying.then((result) => println("Settled:", result));
// later: stop.fire()
```

### Manual tasks and observation

```ts
const manual = superPromise<number>();  // no executor; settle it yourself
manual.resolve(100);                    // or manual.reject(error)

await superPromise(loadUser).tap((user) => println(user.name)); // observe, do not change
```

## Options

| Option | What it does |
|---|---|
| `defer` | Wait for an `AbortSignal` to fire before starting. |
| `delay` | Wait this many milliseconds before the first attempt; normal retries wait too. |
| `timeout` | Abort the attempt after this many milliseconds. `retry` does not retry a timeout. |
| `retry` | Retry this many times after the first attempt, for `n + 1` total attempts. Aborts and timeouts are never retried. |
| `retryUntil` | Keep retrying until the stop signal fires. Overrides `retry` and the top-level `delay`. |
| `group` | Shared [taskGroup](task-group.md) admission. A retry reacquires admission. |

## Notes

- A task does not start until you consume it (`await`, `.then()`, or a runner's `start()`). This
  lets you wire dependencies before anything runs.
- The executor's thrown errors become `Err`, not rejections. `.then` receives the settled `Result`;
  `.catch` does not see executor failures.
- `timeout` aborts the operation. `retry` does not retry a timeout; `retryUntil` keeps trying after
  one until its stop signal fires.
- `retryUntil`'s `delay` applies between attempts, not before the first.
- `abort()` settles the task with `Err("Aborted")` if it has not settled already.
- A manual task settles once. The first `resolve` or `reject` wins; later calls do nothing.
- `tap` observes a successful value without changing it. If the callback throws, the task settles
  as `Err`.
- While a task waits for group admission, its timeout has not started. The timeout applies to the
  attempt once it starts.

## See also

- [SuperRunner](super-runner.md)
- [taskGroup](task-group.md)
- [Signal](signal.md)
- [Result](result.md)
