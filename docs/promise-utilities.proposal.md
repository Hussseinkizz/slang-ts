# Promise Utilities Proposal

## Overview

Async/Promise utilities to complement existing slang patterns. These utilities integrate with `Result` type for consistent error handling.

---

## Proposed Utilities

### 1. `deferred<T>()` - Controllable Promise

Create a promise with externally accessible resolve/reject controls.

```ts
interface Deferred<T> {
  promise: Promise<Result<T, string>>;
  resolve: (value: T) => void;
  reject: (reason: string) => void;
  isSettled: boolean;
}

function deferred<T>(): Deferred<T>;
```

**Usage:**

```ts
// Create controllable promise
const task = deferred<User>();

// Resolve or reject from anywhere
if (success) {
  task.resolve(user);
} else {
  task.reject("User not found");
}

// Await it
const result = await task.promise;
if (result.isOk) {
  println("User:", result.value);
}
```

**Use Cases:**

```ts
// Event-based resolution
const clicked = deferred<MouseEvent>();
button.addEventListener("click", (e) => clicked.resolve(e), { once: true });
const event = await clicked.promise;

// External control flow
const ready = deferred<Config>();

async function init() {
  const config = await loadConfig();
  ready.resolve(config);
}

async function doWork() {
  const config = await ready.promise;  // waits until init() resolves
}

// Manual timeout control
const task = deferred<Data>();
const timeout = setTimeout(() => task.reject("Timed out"), 5000);

fetchData().then((data) => {
  clearTimeout(timeout);
  task.resolve(data);
});
```

---

### 2. `all([...])` - Parallel Execution

Execute multiple async operations in parallel. Fails fast on first error by default.

```ts
type AllOptions = {
  collectErrors?: boolean;  // if true, collects all errors instead of fail-fast
};

function all<T>(
  tasks: Promise<Result<T, string>>[],
  options?: AllOptions
): Promise<Result<T[], string | string[]>>;
```

**Usage:**

```ts
// Fail fast (default) - stops on first Err
const result = await all([
  safeTry(() => fetchUser(1)),
  safeTry(() => fetchUser(2)),
  safeTry(() => fetchUser(3)),
]);
// Ok([user1, user2, user3]) or Err("first error")

// Collect all errors
const result = await all([...], { collectErrors: true });
// Ok([user1, user2, user3]) or Err(["error1", "error2"])
```

---

### 3. `settle([...])` - Parallel, Collect All

Execute all operations and return all Results regardless of success/failure.

```ts
function settle<T>(
  tasks: Promise<Result<T, string>>[]
): Promise<Result<T, string>[]>;
```

**Usage:**

```ts
const results = await settle([
  safeTry(() => fetchUser(1)),
  safeTry(() => fetchUser(2)),  // might fail
  safeTry(() => fetchUser(3)),
]);
// [Ok(user1), Err("not found"), Ok(user3)]

// Process results
results.forEach((r, i) => {
  if (r.isOk) println(`User ${i}:`, r.value);
  else println(`Failed ${i}:`, r.error);
});
```

---

### 4. `race([...])` - First to Complete

Returns the first Result to complete. If all fail, returns last Err.

```ts
function race<T>(
  tasks: Promise<Result<T, string>>[]
): Promise<Result<T, string>>;
```

**Usage:**

```ts
const result = await race([
  safeTry(() => fetchFromPrimary()),
  safeTry(() => fetchFromBackup()),
]);
// Returns first Ok, or last Err if all fail
```

---

### 5. `retry(fn, options)` - Retry with Backoff

Retry an async operation with configurable attempts and delay.

```ts
type RetryOptions = {
  attempts?: number;   // default: 3
  delay?: number;      // ms between attempts, default: 1000
  backoff?: number;    // multiply delay each attempt, default: 1 (no backoff)
  onRetry?: (attempt: number, error: string) => void;
};

function retry<T>(
  fn: () => Promise<Result<T, string>>,
  options?: RetryOptions
): Promise<Result<T, string>>;
```

**Usage:**

```ts
const result = await retry(
  () => safeTry(() => fetchData()),
  {
    attempts: 3,
    delay: 1000,
    backoff: 2,  // delays: 1000ms, 2000ms, 4000ms
    onRetry: (attempt, err) => println(`Retry ${attempt}:`, err),
  }
);
```

---

### 6. `withTimeout(fn, ms)` - Timeout Wrapper

Wrap an async operation with a timeout.

```ts
function withTimeout<T>(
  fn: () => Promise<Result<T, string>>,
  ms: number
): Promise<Result<T, string>>;
```

**Usage:**

```ts
const result = await withTimeout(
  () => safeTry(() => fetchSlowData()),
  5000
);
// Ok(data) or Err("Operation timed out")
```

---

## File Structure

```
src/
  async.ts          # All async utilities in one file
  # OR
  async/
    deferred.ts
    all.ts
    settle.ts
    race.ts
    retry.ts
    timeout.ts
    index.ts        # Barrel export
```

---

## Open Questions

1. **`deferred` return type:** Should it return `Promise<Result<T, string>>` (integrated) or plain `Promise<T>` (standard)?

2. **`all` error handling:** Current proposal has `collectErrors` option. Is this sufficient or should there be separate functions?

3. **Naming:** Are these names clear? Alternatives:
   - `settle` vs `allSettled`
   - `withTimeout` vs `timeout`
   - `deferred` vs `defer` vs `promise`

4. **Integration:** Should these work only with `Result`-returning promises or also plain promises?

---

## Priority

| Utility | Priority | Reasoning |
|---------|----------|-----------|
| `deferred` | High | Enables clean promise creation pattern |
| `all` | High | Common pattern for parallel operations |
| `settle` | Medium | Useful but less common |
| `withTimeout` | Medium | Common need, easy to implement |
| `retry` | Medium | Useful for network operations |
| `race` | Low | Less common use case |

---

## Next Steps

1. Discuss and finalize API design
2. Implement `deferred` and `all` first
3. Add tests
4. Document in README
