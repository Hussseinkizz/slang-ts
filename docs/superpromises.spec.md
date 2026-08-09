# SuperPromise / SuperRunner / Channel — Implementation Specification

## 1. Purpose

A small TypeScript async utility library built on native JavaScript Promises.

Three independent primitives:

* **SuperPromise** — one async operation + lifecycle/execution ergonomics.
* **SuperRunner** — orchestration of multiple SuperPromises.
* **Channel** — event communication.

Supporting primitive:

* **Signal** — lifecycle trigger used for dependencies/cancellation.

Application-facing async outcomes use `Result<T, E>`.

Core philosophy:

> Promise handles async mechanics. Result handles application outcomes. SuperPromise handles one operation. SuperRunner handles orchestration. Channel handles communication.

---

# 2. Result

Application-level async operations resolve to:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

The exact representation is an ADR decision.

Primary usage:

```ts
const result = await sp(fetchUser);

if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

SuperPromise remains Promise-compatible and supports normal Promise composition:

```ts
sp(fetchUser)
  .then(...)
  .catch(...)
  .finally(...);
```

Do not expose a separate `.result` property.

---

# 3. SuperPromise

## Construction

```ts
const task = superPromise(fn, options?);
```

Short alias:

```ts
const task = sp(fn, options?);
```

The executor receives an `AbortSignal`:

```ts
const task = sp(async signal => {
  const response = await fetch(url, { signal });
  return response.json();
});
```

Primary consumption:

```ts
const result = await task;
```

---

## Empty / manually controlled SuperPromise

Calling without an executor creates an externally controlled SuperPromise:

```ts
const task = sp<number>();

task.resolve(100);

const result = await task;
```

Or:

```ts
task.reject(error);
```

First settlement wins, consistent with Promise semantics.

---

# 4. SuperPromise lifecycle API

These remain methods/properties because they operate on an existing task.

## `.done`

A lifecycle signal indicating that the operation has reached its terminal state.

```ts
task.done;
```

`.done` is:

* not the operation result;
* not a Promise carrying the result;
* not a Channel.

It exists for lifecycle dependencies and integrations.

Example:

```ts
const config = sp(loadConfig);

const user = sp(loadUser, {
  defer: config.done
});
```

---

## `.abort()`

Cancel the operation:

```ts
task.abort();
```

Use an internal `AbortController`/`AbortSignal`.

Signal-aware executors receive that signal.

---

## `.resolve(value)`

Manually settle an externally controlled SuperPromise:

```ts
const task = sp<number>();

task.resolve(100);
```

---

## `.reject(error)`

Manually reject an externally controlled SuperPromise:

```ts
const task = sp<number>();

task.reject(error);
```

---

# 5. SuperPromise options

Execution policies are configured during construction:

```ts
sp(fn, {
  defer: signal,
  delay: 1000,
  timeout: 5000,
  retry: 3,
});
```

General rule:

> **Options configure execution; methods interact with lifecycle.**

---

## `defer`

```ts
{
  defer: signal
}
```

Do not execute until the supplied signal fires.

```ts
const first = sp(loadConfig);

const second = sp(loadUser, {
  defer: first.done
});
```

Accept compatible lifecycle signals, including SuperPromise signals and `AbortSignal`.

The abstraction should hide microtask/event-loop details from callers.

---

## `delay`

```ts
{
  delay: 1000
}
```

Delay initial execution.

```ts
const result = await sp(fetchData, {
  delay: 1000
});
```

Normal retries respect this delay:

```ts
sp(fetchData, {
  delay: 1000,
  retry: 3
});
```

Conceptually:

```text
wait → execute → fail → wait → retry → ...
```

---

## `timeout`

```ts
{
  timeout: 5000
}
```

Timeout must cancel the underlying operation.

Conceptually:

```text
operation
    │
    ├── completes → clear timer
    │
    └── timer fires → abort → timeout failure
```

A Promise race may be used internally, but merely abandoning the Promise is insufficient.

Example:

```ts
const result = await sp(
  signal => fetch(url, { signal }),
  { timeout: 5000 }
);
```

---

## `retry`

```ts
{
  retry: 3
}
```

Retry failed execution.

Normal retries respect `delay`.

Exact counting semantics are an ADR decision.

---

## `retryUntil`

```ts
{
  retryUntil: {
    signal,
    delay: 5000
  }
}
```

Continue retrying until the supplied signal fires.

`retryUntil` has its own retry preferences and **overrides normal `retry` and `delay` retry behavior**.

Example:

```ts
const stop = new AbortController();

const result = await sp(fetchData, {
  retryUntil: {
    signal: stop.signal,
    delay: 5000
  }
});
```

---

## `.tap()`

The only agreed fluent convenience operation.

```ts
const result = await sp(loadUser)
  .tap(user => console.log(user));
```

`tap()` observes a successful value without transforming it:

```text
T → tap(sideEffect) → T
```

Exact failure semantics if the callback throws are an ADR decision.

---

# 6. Explicitly excluded from SuperPromise

Do not implement unless explicitly added by a future ADR:

```text
.start()
.result
.before()
.clone()
.copy()
.map()
.flatMap()
.all()
.race()
.any()
.allSettled()
```

Multi-operation orchestration belongs to `SuperRunner`.

---

# 7. SuperRunner

`SuperRunner` orchestrates multiple **already-created SuperPromises**.

It must not accept:

* bare Promises;
* arbitrary executor functions.

Example:

```ts
const user = sp(getUser);
const posts = sp(getPosts);

const task = superRunner({
  type: "all",
  runners: {
    user,
    posts
  }
});
```

A SuperRunner has an explicit execution boundary:

```ts
const result = await task.start();
```

Lifecycle:

```ts
task.start();
task.abort();
task.done;
```

There is no `.result`.

There is no `.defer()`.

---

# 8. SuperRunner — `sequence`

Uses an array because order is intrinsic.

```ts
const task = superRunner({
  type: "sequence",
  runners: [
    sp(authenticate),
    sp(loadProfile),
    sp(loadDashboard)
  ]
});

const result = await task.start();
```

Execution:

```text
authenticate
     ↓
loadProfile
     ↓
loadDashboard
```

Only `sequence` guarantees execution order.

Result is positional:

```ts
[
  authenticationResult,
  profileResult,
  dashboardResult
]
```

---

# 9. SuperRunner — `all`

Uses a named object because execution order is irrelevant and result identity matters.

```ts
const task = superRunner({
  type: "all",
  runners: {
    user: sp(getUser),
    posts: sp(getPosts),
    settings: sp(getSettings)
  }
});

const result = await task.start();
```

All runners execute independently/concurrently.

Result:

```ts
{
  user: ...,
  posts: ...,
  settings: ...
}
```

There is no execution-order guarantee.

Aborting the runner propagates cancellation to active children:

```ts
task.abort();
```

---

# 10. SuperRunner — `race`

Uses a named object and winner count.

```ts
const task = superRunner({
  type: "race",
  count: 2,
  runners: {
    primary: sp(fetchPrimary),
    backup: sp(fetchBackup),
    cache: sp(fetchCache),
    replica: sp(fetchReplica)
  }
});

const result = await task.start();
```

Semantics:

* A winner is a **successful completion**.
* Failure does not consume a winner slot.
* `count: 1` = first successful completion.
* `count: 3` = first three successful completions.
* Completion order determines winners.
* Input order does not determine winners.
* Once enough winners exist, remaining active runners are aborted.
* Result contains only winners.
* No `null` placeholders.
* Result keys identify the winning runners.

Example:

```text
cache     → success #1
secondary → failure
replica   → success #2
primary   → aborted
```

Result:

```ts
{
  cache: ...,
  replica: ...
}
```

Winner/completion order should be preserved where object iteration order is relevant.

---

# 11. SuperRunner lifecycle

Every child is a SuperPromise, so cancellation remains coherent.

```ts
task.abort();
```

Conceptually:

```text
runner.abort()
    ├── child A.abort()
    ├── child B.abort()
    └── child C.abort()
```

The runner exposes:

```ts
task.done;
```

as its lifecycle signal.

---

# 12. Channel

Channel is completely independent from SuperPromise and SuperRunner.

Channels are created through a **factory function**:

```ts
const channel = createChannel();
```

Not:

```ts
new Channel()
```

and not:

```ts
newChannel()
```

Public API:

```ts
channel.send(...)
channel.sub(...)
channel.when(...)
```

---

## `.send()`

Immediately publish an event:

```ts
channel.send({
  topic: "user.created",
  data: user
});
```

Event shape:

```ts
{
  topic: string;
  data: unknown;
}
```

---

## `.sub()`

Subscribe to events from this channel:

```ts
channel.sub({
  topic: "user.created"
}, event => {
  console.log(event.data);
});
```

Subscription/unsubscription semantics are an ADR decision.

---

## `.when()`

Publish an event when a signal fires:

```ts
channel.when({
  signal: task.done,
  topic: "task.completed",
  data: {
    id: taskId
  }
});
```

Compatible signals include:

```ts
task.done
controller.signal
```

The Channel does not know or care where the signal originated.

---

# 13. Primitive separation

```text
Signal
  └── lifecycle trigger

SuperPromise
  └── one async operation
      ├── Result<T,E>
      ├── defer
      ├── delay
      ├── timeout
      ├── retry
      ├── retryUntil
      ├── abort
      └── done

SuperRunner
  └── multiple SuperPromises
      ├── sequence
      ├── all
      └── race(n)

Channel
  └── communication
      ├── send
      ├── sub
      └── when
```

The primitives remain decoupled.

A SuperPromise signal can interact with a Channel:

```ts
channel.when({
  signal: task.done,
  topic: "completed",
  data: taskId
});
```

But Channel must not depend on SuperPromise.

---

# 14. Representative usage

### Simple operation

```ts
const result = await sp(async signal => {
  const response = await fetch("/api/user", { signal });
  return response.json();
});
```

### Timeout + retry

```ts
const result = await sp(fetchData, {
  timeout: 5000,
  retry: 3,
  delay: 1000
});
```

### Lifecycle dependency

```ts
const config = sp(loadConfig);

const user = sp(loadUser, {
  defer: config.done
});
```

### Manual operation

```ts
const task = sp<number>();

externalSource.onValue(value => {
  task.resolve(value);
});

externalSource.onError(error => {
  task.reject(error);
});

const result = await task;
```

### Parallel orchestration

```ts
const workflow = superRunner({
  type: "all",
  runners: {
    user: sp(getUser),
    posts: sp(getPosts),
    settings: sp(getSettings)
  }
});

const result = await workflow.start();
```

### Ordered workflow

```ts
const workflow = superRunner({
  type: "sequence",
  runners: [
    sp(authenticate),
    sp(loadAccount),
    sp(loadDashboard)
  ]
});

const result = await workflow.start();
```

### First successful source

```ts
const workflow = superRunner({
  type: "race",
  count: 1,
  runners: {
    primary: sp(fetchPrimary),
    backup: sp(fetchBackup),
    cache: sp(fetchCache)
  }
});

const result = await workflow.start();
```

### Event triggered by lifecycle

```ts
const channel = createChannel();

channel.when({
  signal: workflow.done,
  topic: "workflow.completed",
  data: { workflowId }
});
```

---

# 15. Public API summary

```ts
// Single operation
sp(fn?, options?)

// Lifecycle
task.done
task.abort()
task.resolve(value)
task.reject(error)

// Execution options
{
  defer,
  delay,
  timeout,
  retry,
  retryUntil
}

// Value observation
task.tap(fn)

// Multiple operations
superRunner({
  type: "sequence",
  runners: [...]
})

superRunner({
  type: "all",
  runners: {...}
})

superRunner({
  type: "race",
  count: number,
  runners: {...}
})

// Runner lifecycle
runner.start()
runner.abort()
runner.done

// Communication
createChannel()

channel.send(...)
channel.sub(...)
channel.when(...)
```

---

# 16. ADR requirements

The implementor must create ADRs for unresolved semantics rather than silently inventing behavior:

1. `Result<T,E>` representation and error normalization.
2. Native `.then/.catch` behavior relative to `Result`.
3. Exact `retry(n)` counting semantics.
4. Retryable vs non-retryable errors.
5. `retryUntil` behavior when its signal fires during an active attempt.
6. Timeout vs explicit abort error representation.
7. Exact terminal-state behavior of `.done`.
8. `tap()` failure behavior.
9. `sequence` failure semantics.
10. `all` failure/result semantics.
11. `race` behavior when all runners fail.
12. Repeated `SuperRunner.start()` behavior.
13. Signal interface and compatibility with native `AbortSignal`.
14. Channel subscription/unsubscription semantics.
15. Type inference for sequence tuples and named runner results.

Do not introduce additional public primitives without an explicit design decision.
