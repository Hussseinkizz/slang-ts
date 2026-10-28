# Slang: Utility Extensions Specification

**Status:** Implemented — 2026-10-28  
**Scope:** Collection adapters, Result integration, lazy iteration, memoization, task groups, and Stepper  
**Companion:** [Design Decisions and ADRs](./slang-utilities-decisions.md)  
**Baseline:** `slang-ts` v0.2.0; this document describes the shipped behavior.

## 1. Purpose

Extend Slang with a small, composable set of utilities instead of reproducing a large Lodash-style catalogue. A few primitives should cover safe structure access, sequence manipulation, set membership, lazy transformations, controlled async execution, and remembered step-by-step progress.

### 1.1 Design principles

1. **Few primitives, broad coverage.** Prefer `get` over separate `first`, `last`, and `nth` helpers; prefer `iterate` over numerous eager transforms.
2. **Explicit failure handling.** Fallible collection operations retain errors until resolved by `.else(...)` or `.panic(...)` using Slang's existing mandatory-resolution approach. Do not silently correct invalid arguments.
3. **Success is not truthiness.** `Ok(0)`, `Ok(false)`, `Ok("")`, and `Ok(undefined)` remain success paths, even when a *separate* utility such as `prune` classifies some values as removable.
4. **Raw values and successful Results are accepted.** `struct`, `list`, and `sets` accept a raw matching value or a type-narrowed `Ok<T>`; never an `Err` or an un-narrowed Result. Their operations are fallible.
5. **Retain host-language strengths.** Use native arrays, sets, maps, and generators internally. Do not implement redundant versions of native language capabilities without value.
6. **Separate data from execution.** Collections transform data; `memoized` caches functions; `taskGroup` schedules asynchronous tasks; Stepper maintains navigable history.
7. **Runtime checks matter.** Validate indices, counts, object shape, step keys, and limits even if TypeScript types appear correct.
8. **Do not widen agreed APIs for convenience.** In particular, Stepper has only `next`, `prev`, `current`, and `size` as its public surface.

## 2. Compatibility and naming

Existing Slang exports (`Ok`, `Err`, `Result`, `Option`, `isFalsy`, `andThen`, `superPromise`, `superRunner`, `panic`, and others) remain intact. All examples below illustrate the added APIs. No breaking change to `superRunner({ type, runners, ... }).start()` is intended.

**Naming conventions:** `new` is a reserved JavaScript/TypeScript keyword and cannot be used as a callback parameter. The callback's second parameter is *semantically* the step constructor; examples call it `make`, but callers can name it `newStep`, `emit`, etc. The actual API is `make({ key, value })`, **not** `make(key, value)`.

## 3. Unified error and Result model

### 3.1 Accepted inputs

```ts
struct(record);             // allowed
struct(Ok(record));         // allowed: known Ok
list([1, 2, 3]);           // allowed
list(Ok([1, 2, 3]));       // allowed
sets({ read: true });      // allowed: keys form the set

const outcome: Result<number[], Error> = loadNumbers();
if (outcome.isOk) {
  list(outcome).take(2).else([]);  // allowed after narrowing
}

// Reject in TypeScript and at runtime where necessary:
// list(Err("bad"));
// list(outcome);  // not narrowed
```

`struct`, `list`, and `sets` must not implicitly unwrap a possible `Err`. Type-level restrictions should be backed by a runtime guard when given a value cast to an invalid type.

### 3.2 Fallible transformation chain

- Adapter operations produce a **Result-compatible fallible outcome**, not a naked value.
- The chain retains either successful transformed data or a typed failure.
- `.else(fallback)` returns the success value or the fallback value; the fallback may be a function if supported by the shared resolution mechanism.
- `.panic(message?)` returns the successful value, or throws if the chain failed.
- The implementation must reuse/adapt Slang's existing mandatory `.else()` mechanism, rather than designing a separate ad-hoc enforcement method.
- To permit consecutive operations while still hiding them on `Err`, implement an internal typed pipeline/carrier: it may carry `Err` and short-circuit, but exposes collection operations only for the expected successful value type. **This does not mean `Err` objects expose `pick()` or `take()`.**
- `Result` error handling is based on the variant, never the value's JavaScript truthiness.

```ts
const firstTwo = list([4, 5, 6]).take(2).else([]); // [4, 5]
const fallback = list([4, 5, 6]).range(0, 99).else([]); // []
list([4, 5, 6]).range(0, 99).panic("Range out of bounds"); // throws

const number = Ok(0);
// The value is a valid success; it must not select the fallback.
```

**Stepper exception:** `stepper.next(...)` returns a normal `Result` directly and **does not require** `.else()` or `.panic()`. `stepper.prev(...)` deliberately requires one of those terminal methods (Section 9).

### 3.3 Error categories

Use consistent typed errors with a stable `code` (listed below) and a human-readable message. Specific error constructors are implementation details.

| Code | Typical cause | Result or throw |
|---|---|---|
| `INVALID_INPUT` | Wrong shape/type at runtime | `Err` |
| `INVALID_INDEX` | NaN, fractional or infinite index or count | `Err` |
| `OUT_OF_BOUNDS` | `take`, `skip`, `range`, `get` outside a list | `Err` |
| `INVALID_RANGE` | Normalized range start exceeds end | `Err` |
| `INVALID_CHUNK_SIZE` | Nonpositive or nonintegral size | `Err` |

Stepper does not expose `code`; `next` returns a normal `Result` with a human-readable error message, and backward navigation panics through `.else(...)`/`.panic(...)`. Duplicate retained keys, rejected keys, and invalid boundaries panic immediately.

## 4. `struct()` — object shaping and record aggregation

### 4.1 Methods

| Method | Purpose | Notes |
|---|---|---|
| `get(path, fallback?)` | Safe property/nested-path lookup | Path is key or typed key array; avoid ambiguous dot-string parsing |
| `pick(...keys)` | Include selected keys | Shallow, immutably produces a new record |
| `omit(...keys)` | Exclude selected keys | Shallow, immutably produces a new record |
| `merge(source)` | Merge a source into destination passed to `struct` | Must not mutate destination |
| `count()` | Count own enumerable keys | An object-oriented `count`, not recursive |
| `countBy(selector)` | Count records per derived key | For a collection of records provided to `struct` |
| `keyBy(selector)` | Index records by a derived key | For a collection of records provided to `struct` |
| `prune(predicate?)` | Remove unwanted fields | Defaults to Slang's `isFalsy`; optional predicate overrides |

### 4.2 Examples

```ts
const user = { id: 1, name: "Ada", password: "secret", profile: { city: "Kampala" } };

struct(user).get(["profile", "city"]).else("unknown"); // "Kampala"
struct(user).pick("id", "name").else({});                 // { id: 1, name: "Ada" }
struct(user).omit("password").panic("Unexpected error");
struct(user).count().else(0);                              // 4

const rows = [
  { id: 1, role: "admin" },
  { id: 2, role: "user" },
  { id: 3, role: "admin" },
];

struct(rows).countBy(x => x.role).else({}); // { admin: 2, user: 1 }
struct(rows).keyBy(x => x.id).else({});     // { 1: rows[0], 2: rows[1], 3: rows[2] }
```

**Shared accumulator:** `countBy` and `keyBy` use a `Map` and build the result with `Object.fromEntries`, so numeric keys become property keys and keys such as `__proto__` stay own properties.

**Merge policy:** Recursively merge plain objects; replace arrays, Maps, Sets, dates, and incompatible values; don't mutate the input; skip `__proto__`, `constructor`, and `prototype` keys. Cyclic structures are not supported.

**Duplicate `keyBy` keys:** Last value wins.

## 5. `list()` — finite indexed collections

`list()` is for finite indexable sequences (arrays). **Iterators/generators are not accepted by `list()`**; use Stepper for controllable generated progression or `Ok(...).iterate()` for lazy transformation.

### 5.1 Methods

| Method | Semantics | Validation |
|---|---|---|
| `get(index, fallback?)` | Retrieve indexed item; negative indices count from end | Index must be an integer; unavailable index returns fallback or `Err` |
| `take(n)` | Take first `n` items | `0 <= n <= length`; no clamping |
| `skip(n)` | `n > 0`: skip first `n`; `n < 0`: skip last `abs(n)`; zero: skip none | `abs(n) <= length`; integer only; no iterators |
| `range(start, end)` | Half-open slice `[start, end)` | Negative indices supported; normalize then validate both bounds and order |
| `chunk(size)` | Split list into consecutive groups of at most `size` | Positive safe integer |
| `count()` | List length | Nonnegative integer |
| `prune(predicate?)` | Remove values classified as unwanted | Default `isFalsy`; predicate `true` means retain |

All methods return fallible Result-compatible outcomes and require explicit terminal extraction.

### 5.2 Strict bounds

```ts
const values = [10, 20, 30, 40, 50];

list(values).take(2).else([]);          // [10, 20]
list(values).skip(2).else([]);          // [30, 40, 50]
list(values).skip(-2).else([]);         // [10, 20, 30]
list(values).range(1, 4).else([]);      // [20, 30, 40]
list(values).range(-3, -1).else([]);    // [30, 40]
list(values).range(1, 99).else([]);     // [] (Err resolved via fallback)
list(values).range(1, 99).panic("Out of bounds"); // throws

// NO auto-bounding/clamping option:
// list(values).range(1, 99, { bounds: true }); // unsupported
```

For length `L`, accepted normalized range endpoints are in `[0, L]`, with `start <= end` and `end` exclusive. `range(L, L)` is a valid empty range; `range(-1, L)` contains the final element. Invalid values return `Err`; they are never silently adjusted.

### 5.3 Pruning

Reuse Slang's existing Option-oriented `isFalsy` classification; **do not use JavaScript `Boolean(value)`**. Per the public semantics, `null`, `undefined`, `""`, `NaN`, and infinities are excluded by default, while `0` and `false` remain valid.

```ts
list([0, false, "", null, NaN, 5]).prune().else([]); // [0, false, 5]
list([-2, 0, 3, 4]).prune(x => x > 0).else([]);       // [3, 4]
struct({ a: 0, b: false, c: "", d: 5 }).prune().else({});
// { a: 0, b: false, d: 5 }
```

A supplied predicate **replaces** the default test and returns `true` to keep a value. For struct, the predicate may receive `(value, key)`; for list, `(value, index)`.

## 6. `sets()` — membership and set algebra

Normalize supported inputs to a native `Set` internally:

| Source | Members |
|---|---|
| Array / iterable | Its yielded items |
| Native `Set` | Its members |
| Native `Map` | Its keys |
| Plain object | Its **own enumerable keys**, regardless of associated values |

No `Object.keys(record)` ceremony is required from the user. Users who want an object's values can call `sets(Object.values(record))` or otherwise supply those values explicitly.

| Method | Meaning | Proposed output |
|---|---|---|
| `has(x)` | Membership check | `Result<boolean, E>` |
| `unique()` | Materialize distinct members | `Result<Set<T>, E>` |
| `union(other)` | Membership in either input | `Result<Set<T>, E>` |
| `intersection(other)` | Members shared by both | `Result<Set<T>, E>` |
| `difference(other)` | Members present only in first | `Result<Set<T>, E>` |
| `count()` | Number of distinct members | `Result<number, E>` |

```ts
sets({ read: true, write: false }).has("write").else(false); // true
sets([1, 2, 2, 3]).unique().else(new Set());        // Set(1, 2, 3)
sets([1, 2]).union([2, 3]).else(new Set());         // Set(1, 2, 3)
```

Equality follows the native JS `Set` semantics (SameValueZero for primitives, identity for objects). Set operations don't mutate the source.

## 7. `.iterate()` — lazy processing on `Ok`

`.iterate()` is a **Result-success-path capability**, not a method on a raw array, `list()` adapter, or ordinary generator. It creates a generator-backed lazy pipeline over the successful underlying collection.

```ts
const names = Ok(users)
  .iterate()
  .filter(user => user.active)
  .map(user => user.name)
  .take(100)
  .chunk(20)
  .toArray()
  .else([]);
```

Supported chain operations: `map`, `filter`, `flatMap`, `take`, `drop`, `chunk`, `reduce`, `count`, `toArray`. Transformations should be lazy where sensible; terminal operations consume the pipeline. The pipeline should stop early when `take` is satisfied and clean up the source iterator.

**Failure:** Errors thrown while iterating or transforming are captured in the Result path at evaluation. `.else()` returns a fallback; `.panic()` throws. Materialized partial results must not be presented as complete success. A source that is a one-shot generator must not be silently replayed.

**Performance:** Use generators/lazy iteration to avoid intermediate allocation, not on the assumption that generators are universally faster. Benchmark against native array pipelines. AsyncIterable integration is a possible follow-up, **not a V1 promise**.

## 8. `memoized(fn)` — argument-based function caching

```ts
const expensive = memoized((a: number, b: number) => compute(a, b));
expensive(1, 2); // compute
expensive(1, 2); // cache hit
expensive.clear();
```

- No dependency array or dependency callback; **memoize arguments only**.
- Cache by argument values/identities, not `JSON.stringify`.
- Use appropriate `Map` / `WeakMap` structures where practical; object arguments compare by identity.
- Cache `undefined` as a legitimate return value.
- Default proposal: evict rejected Promises, so a later invocation can retry. Do not cache thrown synchronous errors.
- Provide `clear()` on the returned function.
- No general-purpose size policy required for the first design; document that long-lived unbounded argument caches can consume memory.

This is distinct from Stepper's retained history. Stepper **does not memoize callback arguments or function identities**.

## 9. `createStepper(config)` — keyed step progression with bounded history

### 9.1 Definition

Stepper is **not** a finite-state-machine DSL, a general generator replacement, or a payment transaction engine. It is a small, navigable history manager. Developers supply each forward computation at the call site; Slang validates, commits, remembers recent steps, and supports backward recovery.

**Only public members:** `next`, `prev`, `current`, `size`.

```ts
const stepper = createStepper({
  maxHistory: 50,
  maxSteps: null,
  keyEvalFn: async key => true, // optional external acceptance check
});

const result = stepper.next((prev, make) =>
  make({
    key: "step:1",
    value: { screen: "welcome" }
  })
);

stepper.next(
  (prev, make) => make({ key: "step:2", value: { screen: "details" } }),
  { fallback: true }
);

const prior = stepper.prev().else((prev, make, next) =>
  make({ key: "recovered:1", value: reconstruct(prev, next) })
);

stepper.prev(-2).panic("History unavailable");
const active = stepper.current;
const count = stepper.size;
```

This snippet shows the shipped Stepper API.

### 9.2 Configuration

```ts
type StepperConfig = {
  maxHistory?: number;  // positive integer; default 50
  maxSteps?: number | null; // default null = unlimited forward generations
  keyEvalFn?: (key: string) => boolean | Promise<boolean>;
};

type Step<T> = { key: string; value: T };
```

- `maxHistory` limits the **number of retained full step values and their memoized history entries**. Do not add a separate `cache`, `maxMemo`, or `memoize` option.
- `maxSteps: null` means no limit. If finite, it limits **successful forward step commits over the Stepper lifetime**, not current cache size; past evicted keys may be reused but the new forward commit still counts.
- `keyEvalFn` is an optional **additional acceptance predicate**. `true` accepts, `false` rejects. It can perform external/persistent checking, but a non-atomic read/validate function alone does not guarantee uniqueness across processes. A throwing/rejecting validator returns an execution error; a `false` result rejects the key as an invariant failure.
- Config validation is strict: `maxHistory` must be a positive safe integer; finite `maxSteps` must be a nonnegative safe integer.

### 9.3 Step creation

```ts
type StepFactory<T> = (step: Step<T>) => Step<T>;
type StepFn<T> = (
  previous: Step<T> | undefined,
  make: StepFactory<T>
) => Step<T> | Promise<Step<T>>;

type NextOptions = { fallback?: boolean };
```

`stepper.next(fn, options?)`:

1. Supplies the current step as `prev` (`undefined` on the first call).
2. Runs the caller-provided sync or async `fn`; `make({ key, value })` constructs a candidate.
3. Validates the key (nonempty string), value shape/step shape, local history uniqueness, and optional `keyEvalFn`.
4. Commits a successful step and moves the current position; returns `Ok(step)` (or `Promise<Ok(step)>`).
5. If `fn` throws/rejects, returns `Err(error)` without advancing by default.
6. With `{ fallback: true }`, a **generation error** returns `Ok(currentStep)` when a successful current step exists; it does not advance. If none exists, return `Err`.
7. A duplicate retained key or explicit key rejection **panics immediately** and is not hidden by `fallback: true`.
8. A finite `maxSteps` boundary returns `Err("Step limit reached")`; it must not silently extend or clamp the limit.

`next(fn)` is itself a Result-returning API. **It does not require an `.else()` or `.panic()` chain**, and does not expose `nonce`, `onFail`, or a default resolver configured in `createStepper`.

### 9.4 Key uniqueness and retention

- Step identity is determined **only by its string `key`**; do not compare `value` or deep-equal whole steps.
- Reject a candidate if its key occurs anywhere in the **currently retained history**.
- Reuse of a key **after the old step has been evicted** is permitted by default.
- Call `keyEvalFn(key)` additionally if supplied; it can enforce a stronger externally persisted rule.
- No nonce is needed. A caller who intentionally wants another occurrence should supply a different key (or wait until the earlier key has genuinely been evicted, subject to `keyEvalFn`).
- `maxHistory` bounds cached step values; a lifetime registry of all previous keys must **not** be retained by default.

### 9.5 Backward navigation and mandatory resolution

`stepper.prev()` means `stepper.prev(-1)`. `stepper.prev(-2)` requests two positions backward. Only negative safe integers are valid; `0`, positive numbers, fractions, and infinities are invalid.

**`prev` is different from `next`: it must be explicitly finished with `.else(recover)` or `.panic(message)`**, reusing Slang's existing mandatory-resolution approach.

```ts
// Cached step is returned; recover callback does not run.
const earlier = stepper.prev().else((prev, make, next) =>
  make({ key: "restored", value: reconstruct(prev, next) })
);

// Reject unavailable history explicitly.
const earlierStrict = stepper.prev(-2).panic("History missing");
```

When target history exists but its value was evicted, `.else((prev?, make, next?) => ...)` reconstructs that missing step. `prev` and `next` callback parameters are the nearest available neighboring steps (either may be `undefined`). The returned step is validated and inserted at the requested history position, respecting `maxHistory`; only after success does the current position move.

**Boundary behavior:** A request for a position before the logical first step is invalid, not an invitation to invent a step. Both `.else(...)` and `.panic(...)` throw `Cannot step before the first step`; a recovery callback cannot change the origin.

Backward recovery is not a general `force` operation. There is no API for forced refetch of a retained step.

### 9.6 Read-only inspection

```ts
stepper.current; // Step<T> | undefined; initially undefined
stepper.size;    // number of steps currently retained; initially 0
```

Both are O(1), do not execute callbacks, and do not move the current position.

### 9.7 History behavior

- The Stepper keeps a logical order/position and at most `maxHistory` retained step values.
- A successful forward `next(fn)` produces a new step; it does **not** silently replay or memoize a previously supplied callback by argument identity.
- After moving backward, a new successful `next(fn)` replaces the abandoned future path in a **linear-history** model. Duplicate checks and `keyEvalFn` run against the retained history before the branch is truncated on commit.
- An evicted step cannot be returned directly; `prev(...).else(recover)` is the explicit reconstruction path.
- A failed generation/recovery never advances position or commits partial history.
- Async operations for the same Stepper must be serialized to keep key checks, limits, and current position consistent.
- A sync generator stays sync; an async generator/validator yields a Promise-returning result. The library must not silently fire-and-forget asynchronous validation.

### 9.8 Explicit nonfeatures

No `at()`, `forceNext()`, `forcePrev()`, `tryNext()`, `tryPrev()`, `trigger()`, `nonce`, `onFail`, default generator in the constructor, automatic replay of arbitrary generators, or built-in persistent storage. These were discussed and removed to keep Stepper small.

## 10. `taskGroup()` — scheduling shared work

Preserve the existing `superRunner` `sequence` / `all` / `race` signatures and its single-use `.start()` behavior. Add an **optional shared task-group resource** to the task/SuperPromise options, so separately created tasks and runners can coordinate.

```ts
const apiGroup = taskGroup("upstream-api", {
  concurrency: 3,
  throttle: 200, // milliseconds between admitted starts
});

const runner = superRunner({
  type: "all",
  runners: {
    users: superPromise(fetchUsers, { group: apiGroup }),
    posts: superPromise(fetchPosts, { group: apiGroup }),
  }
});

await runner.start();
```

**Requirements:**

- Shared group identity governs scheduling across all participating tasks, regardless of runner instance.
- `concurrency` limits simultaneous active group tasks.
- `throttle` spaces admission of newly started tasks; it does not cancel running tasks.
- A retry is a new admission and must reacquire scheduling permission.
- A group may support `debounce` for **pending tasks sharing a deduplication key**; it may supersede queued, not running, work. This needs a documented cancellation/result policy before shipping.
- Do not add `.trigger()` or make the existing SuperRunner reusable merely to support scheduling.
- TaskGroup manages execution, not application-level idempotency or transactional semantics.

## 11. Acceptance matrix (verified)

### Result/adapters

- [x] `Ok(0)` and `Ok(false)` resolve as success; `Err` never masquerades as an empty collection.
- [x] Raw input and narrowed `Ok` input are accepted for all three adapters.
- [x] Unnarrowed Result and `Err` are rejected by types and guarded against at runtime.
- [x] Every fallible adapter operation uses the shared mandatory terminal-resolution behavior.
- [x] Consecutive fallible operations short-circuit after the first failure.
- [x] `struct.pick/omit` preserve inferred TypeScript keys; `merge` avoids mutation and prototype pollution.
- [x] `countBy` and `keyBy` handle duplicate categories/keys and malicious-looking property names.
- [x] `sets(object).has(key)` works even if the object's associated value is `false`.
- [x] Object set membership and JS Set equality semantics are documented.

### Lists/iteration

- [x] `range(1, length)` succeeds; `range(length, length)` yields `[]`.
- [x] `range(1, length + 1)` returns `Err`; **no clamping option exists**.
- [x] `range(start > end)` returns `Err(INVALID_RANGE)`.
- [x] `skip(-2)` removes final two; `skip(2)` removes first two.
- [x] `skip` rejects generators/iterators and invalid counts.
- [x] `prune()` retains `0` and `false`, drops values rejected by Slang `isFalsy`; custom predicate overrides the default.
- [x] `.iterate()` is only available via a narrowed successful Result; lazy `take` stops consumption early.
- [x] Iterator errors become Result failures, never partial successful arrays.

### Memo and task scheduling

- [x] Same primitive argument values and same object-identity arguments hit `memoized` cache.
- [x] Different object instances with equal contents do not accidentally collide.
- [x] `undefined` return is cacheable; `clear()` resets cache.
- [x] Shared task groups enforce concurrency/throttle across multiple SuperRunners.
- [x] Retries reacquire admission; running tasks aren't cancelled by throttling.
- [x] Existing SuperRunner scheduling and result shapes are unchanged without a group.

### Stepper

- [x] First `next` receives `prev === undefined` and can use `make({ key, value })`.
- [x] Sync and async `next` return correct `Result` forms.
- [x] `next` default error returns `Err` without advancing; `{fallback:true}` returns the last successful step when available.
- [x] `next` **does not** require `.else()` or `.panic()`.
- [x] A duplicate key in retained history panics, even when the associated value differs.
- [x] A key may be reused after eviction if `keyEvalFn` approves.
- [x] `keyEvalFn` rejects `false`; external checker errors do not silently accept steps.
- [x] `prev()` equals `prev(-1)`; `prev(-2)` moves two logical steps back when history allows.
- [x] `prev()` must terminate with `.else(...)` or `.panic(...)`; recovered historical steps are validated before commit.
- [x] `current` and `size` stay correct before first step, after success, after eviction, and after failure.
- [x] `maxHistory` bounds retained full steps; `maxSteps:null` is unlimited; finite `maxSteps` is enforced.
- [x] Async concurrent navigation cannot race into duplicate insertion or inconsistent position.

## 12. Excluded / deferred utilities

No standalone `first`, `last`, `nth`, `compact`, `flatten`, `partition`, `cloneDeep`, `isEmpty`, `isEqual`, `isNil`, `clamp`, `random`, `camelCase`, `kebabCase`, `truncate`, `curry`, or general `set`/deep path mutation in this release. `groupBy` is not committed; `countBy` and `keyBy` are. Set operations are expressed through `sets`, while `prune` replaces `compact`.

## 13. Resolved implementation questions

The shipped defaults are:

1. **Default `maxHistory`:** `50`.
2. **`prev().else` at the logical beginning:** both terminals throw `Cannot step before the first step`; the origin is never invented.
3. **Forward-branch truncation:** duplicate and `keyEvalFn` validation run against retained history first; `commit` then deletes positions above the current one.
4. **`struct.countBy/keyBy` inputs:** an array plus a selector; derived keys are stringified; duplicate `keyBy` keys are last-wins.
5. **`merge` edge cases:** only plain objects recurse; arrays, Maps, Sets, Dates, and other values are replaced; symbol keys are ignored; cyclic structures are unsupported.
6. **`keyEvalFn` concurrency:** navigation is serialized inside one Stepper, but atomic cross-process uniqueness still requires consumer-supplied transactional storage.
7. **Async lazy iteration:** deferred; `.iterate()` is synchronous.
8. **Debounced group work:** deferred; task groups provide concurrency and throttle only.

---

**Non-goal:** The USSD payments discussion was an illustrative use case, not a requirement to bundle USSD, payment integrations, transaction state, or persistence with Slang.
