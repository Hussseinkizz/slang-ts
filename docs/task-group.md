# taskGroup

A task group shares concurrency and start spacing across tasks and runners.

## What it is

A `taskGroup` is a scheduler. It limits how many tasks run at once, optionally spaces out their
starts, and keeps that budget shared across every task that references the same group.

It manages execution, not business idempotency. It does not deduplicate work, retry for you, or
cancel running tasks to make room.

## When to use it

- Several `SuperPromise`s call the same upstream and should not all start at once.
- You need to spread starts over time to avoid a burst.
- Different runners should share one concurrency budget.

If a single task needs a timeout or retry, configure the task. Use the group for the shared limit.

## How to use it

A group carries the concurrency and spacing policies and shares them across tasks:

```ts
import { superPromise, taskGroup, superRunner } from "slang-ts";

const api = taskGroup("upstream-api", { concurrency: 3, throttle: 200 });

const runner = superRunner({
  type: "all",
  runners: {
    users: superPromise(fetchUsers, { group: api }),
    posts: superPromise(fetchPosts, { group: api }),
  },
});

await runner.start();
```

Without it, a concurrency limit is a queue with a counter, and spacing starts adds a timer on top:

```ts
function createLimiter(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

const limit = createLimiter(3);
await Promise.all(urls.map((url) => limit(() => fetch(url))));
```

The same group can be shared across runners:

```ts
const first = superRunner({
  type: "all",
  runners: {
    a: superPromise(fetchA, { group: api }),
    b: superPromise(fetchB, { group: api }),
  },
});

const second = superRunner({
  type: "all",
  runners: {
    c: superPromise(fetchC, { group: api }),
    d: superPromise(fetchD, { group: api }),
  },
});

await Promise.all([first.start(), second.start()]);
```

### Manual admission

You can use a group without `SuperPromise`:

```ts
const release = await api.acquire();
try {
  await doWork();
} finally {
  release();
}
```

## Options

| Option | Default | What it does |
|---|---|---|
| `concurrency` | unlimited | Maximum tasks active at once. Must be a positive integer. |
| `throttle` | `0` | Minimum milliseconds between admitted starts. Must be a nonnegative integer. |

The group's `name` is a label for debugging. Identity is the object itself, not the name.

## Notes

- `throttle` spaces starts; it never cancels a running task.
- A retry is a new admission. A retried `SuperPromise` goes back through the group's queue.
- A task waiting for admission has not started, so its timeout has not started either. The timeout
  applies once the attempt is admitted.
- `acquire()` resolves with a release callback. Call it when the work finishes. Releasing twice is
  safe, but the first release is the one that frees the slot.
- Concurrency is shared by object identity. Two groups with the same name are separate budgets.
- There is no debounce. Pending tasks are not merged or superseded.
- Queued work has no cancellation API of its own. Awaiting admission still resolves when a slot
  frees.

## See also

- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
- [Signal](signal.md)
