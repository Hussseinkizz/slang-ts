# SuperPromise

`superPromise(fn, options?)` — one async operation with start, retry, timeout, and cancel controls.
Tasks end as `Ok` or `Err`, so you check the result instead of wrapping every await in `try`/`catch`.

```ts
// Signature
superPromise<T>(fn: (signal: AbortSignal) => T | Promise<T> | Result<T, string>, options?: SuperPromiseOptions): SuperPromise<T>;

/* Options */
{ defer, delay, timeout, retry, retryUntil, group }
/*   defer?: AbortSignal   — wait for this signal before starting
   delay?: number          — ms before first attempt (retries wait too)
   timeout?: number        — ms before aborting an attempt (never retried)
   retry?: number          — retries after first attempt (n + 1 total)
   retryUntil?: { signal: AbortSignal, delay?: number } — retry until signal fires
   group?: TaskGroup       — shared concurrency slot; a retry waits for a new slot */

/* Task methods — never reject */
task.done;          // AbortSignal — fires once when the task finishes
task.abort();       // ends with Err("Aborted")
task.resolve(v);    // manual tasks only; first settlement wins
task.reject(e);     // manual tasks only; first settlement wins
task.tap(fn);       // observes a successful value without changing it
task.then / .catch / .finally — promise-compatible, callback receives the Result
```

Your function receives an `AbortSignal` and returns a value, a `Result`, or a promise of either. The
task starts lazily — on first `await`, `.then()`, or a runner's `start()` — not at creation.

## What it is

`superPromise(fn, options?)` wraps an async operation. Your function receives an `AbortSignal` and
returns a value, a `Result`, or a promise of either.

You can await the task like a normal promise. You get a `Result<T, string>` back, and it doesn't
reject just because your function threw.

## When to use it

- A network or database call needs a timeout, retries, or cancellation.
- You want the result as `Ok`/`Err` instead of a thrown error.
- One task should start only after another finishes.
- You want to cap concurrency or rate-limit starts across many tasks with
  [taskGroup](task-group.md).

For simple work that needs none of that, a plain promise is enough.

## How to use it

### A timeout and retries

You pass the policy as options, and you get a `Result` back:

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

Without it, the same policy lives at the call site: a controller and timer per attempt, plus a loop
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

The task also supports `.then`, and the callback receives the same `Result`.

### Wait for something else first

`defer` holds execution until a signal fires. Chain operations so the next one starts only when the
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
const result = await task; // Err("Aborted")

const stop = createSignal();
const retrying = superPromise(fetchData, {
  retryUntil: { signal: stop, delay: 2000 }, // keep trying until stop fires
});

retrying.then((result) => println("Result:", result));
// later: stop.fire()
```

### Manual tasks and observation

```ts
const manual = superPromise<number>();  // no function; settle it yourself
manual.resolve(100);                    // or manual.reject(error)

await superPromise(loadUser).tap((user) => println(user.name)); // observe, do not change
```

## Options

| Option | What it does |
|---|---|
| `defer` | Wait for an `AbortSignal` to fire before starting. |
| `delay` | Wait this many milliseconds before the first attempt; normal retries wait too. |
| `timeout` | Abort the attempt after this many milliseconds. `retry` doesn't retry a timeout. |
| `retry` | Retry this many times after the first attempt, for `n + 1` total attempts. Aborts and timeouts are never retried. |
| `retryUntil` | Keep retrying until the stop signal fires. Overrides `retry` and the top-level `delay`. |
| `group` | Shared [taskGroup](task-group.md) slot. A retry waits for a new slot. |

## Technical Notes

- A task doesn't start until you use it (`await`, `.then()`, or a runner's `start()`). That lets
  you connect dependencies before anything runs.
- A thrown error from your function becomes `Err`, not a rejection. `.then` receives the finished
  `Result`, and `.catch` doesn't see failures from your function.
- `timeout` aborts the operation. `retry` doesn't retry a timeout, but `retryUntil` keeps trying
  after one until its stop signal fires.
- `retryUntil`'s `delay` applies between attempts, not before the first.
- `abort()` ends the task with `Err("Aborted")` if it hasn't finished already.
- A manual task can only finish once. The first `resolve` or `reject` wins; later calls do nothing.
- `tap` observes a successful value without changing it. If the callback throws, the task ends as
  `Err`.
- While a task waits for a group slot, its timeout hasn't started. The timeout applies to the
  attempt once it starts.

## See also

- [SuperRunner](super-runner.md)
- [taskGroup](task-group.md)
- [Signal](signal.md)
- [Result](result.md)
