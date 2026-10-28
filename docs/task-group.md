# taskGroup

`taskGroup(name, options?)` — a shared concurrency limit and start spacing for tasks and runners.

```ts
// Signature
taskGroup(name: string, options?: { concurrency?: number; throttle?: number }): TaskGroup;

/* Group methods */
group.acquire();   // Promise<release> — waits for a free slot, returns a release callback

/* Options */
{ concurrency?: number }  — max tasks active at once (default unlimited, positive integer)
{ throttle?: number }     — min ms between starts (default 0, nonnegative integer)
```

Every task that references the same group shares that limit. A retry needs a new slot and goes back
through the queue. The group manages execution, not whether your work runs twice — no deduplication,
no retrying for you, no cancelling a running task to make room.

## What it is

A `taskGroup` controls how many tasks run at once and how far apart they start. Every task that
references the same group shares that limit.

It manages execution, not whether your work runs twice. It won't deduplicate work, retry for you,
or cancel a running task to make room.

## When to use it

- Several `SuperPromise`s call the same service and shouldn't all start at once.
- You need to spread starts over time so you don't send a burst.
- Different runners should share one concurrency limit.

If one task needs a timeout or retry, configure that task. Use the group for the shared limit.

## How to use it

A group holds the concurrency and spacing policy for every task that references it:

```ts
import { superPromise, taskGroup, superRunner } from "slang-ts";

const api = taskGroup("user-api", { concurrency: 3, throttle: 200 });

const runner = superRunner({
  type: "all",
  runners: {
    users: superPromise(fetchUsers, { group: api }),
    posts: superPromise(fetchPosts, { group: api }),
  },
});

await runner.start();
```

Without it, you'd write a queue with a counter, then add a timer on top for spacing:

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

You can share the same group across runners:

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

### Use a group directly

You can also use a group without `SuperPromise`:

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
| `concurrency` | unlimited | How many tasks can be active at once. Must be a positive integer. |
| `throttle` | `0` | Minimum milliseconds between starts. Must be a nonnegative integer. |

The group's `name` is just a label for debugging. Identity is the object itself, not the name.

## Notes

- `throttle` only spaces starts. It never cancels a running task.
- A retry needs a new slot, so a retried `SuperPromise` goes back through the group's queue.
- A task waiting for a slot hasn't started, so its timeout hasn't started either. The timeout
  applies once the task gets a slot.
- `acquire()` resolves with a release callback. Call it when the work is done. Releasing twice is
  safe, but the first release is the one that frees the slot.
- Concurrency is shared by object identity, so two groups with the same name are separate limits.
- There's no debounce. Pending tasks aren't merged or replaced.
- Queued work has no cancellation API of its own. Waiting for a slot still resolves when one frees.

## See also

- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
- [Signal](signal.md)
