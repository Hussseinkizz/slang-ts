# Slang Utility Extensions — Design Decision Record

**Status:** Implemented 2026-10-28  
**Companion:** [Utility Extensions Specification](./slang-utilities-spec.md)  
**Date:** 2026-10-28

This record explains the *why* behind the Slang utility APIs. Decisions reflect the final implementation; remaining non-goals are listed under D-018.

## Decision summary

| ID | Decision | Status |
|---|---|---|
| D-001 | Minimal shared primitives, not a broad utility catalogue | Agreed |
| D-002 | Fallible utility operations resolve explicitly via existing Slang conventions | Agreed |
| D-003 | Adapters accept raw values or narrowed `Ok` values, not possible `Err` | Agreed |
| D-004 | `struct`, `list`, `sets` split structure, indexing, and membership | Agreed |
| D-005 | Strict list bounds; signed `skip`, no iterator support | Agreed |
| D-006 | `prune` reuses Slang Option's `isFalsy` or an explicit predicate | Agreed |
| D-007 | `struct` has `count`, `countBy`, and `keyBy` | Agreed |
| D-008 | `sets(object)` means set of the object's keys | Agreed |
| D-009 | `.iterate()` belongs on successful Results | Agreed |
| D-010 | `memoized(fn)` caches by arguments only | Agreed |
| D-011 | Task groups schedule work without changing SuperRunner lifecycle | Agreed |
| D-012 | Stepper has no constructor generator and a tiny API | Agreed |
| D-013 | Step construction uses one named object argument | Agreed |
| D-014 | Stepper accepts repeated keys after eviction, with optional external evaluator | Agreed |
| D-015 | `next` returns a Result and supports `{ fallback: true }` | Agreed |
| D-016 | `prev` uses negative offsets and must resolve with `.else`/`.panic` | Agreed |
| D-017 | Stepper history is also its memoization limit | Agreed |
| D-018 | Remaining edge-case policies | Resolved |

---

## D-001 — Prefer a small basis of primitives

**Context.** The candidate list included dozens of list, set, object, functional, validation, numeric, and string helpers.

**Decision.** Concentrate on `struct`, `list`, `sets`, Result-aware transforms, `.iterate()`, `memoized`, `taskGroup`, and `createStepper`. Build shared internal operations rather than copy dozens of standalone utilities.

**Alternatives declined.** Lodash-style one-function-per-feature API; duplicating built-in `Object`, `Array`, `Set`, and `structuredClone` functions.

**Consequence.** The library stays teachable. Some shorthand operations (`first`, `last`, `nth`, `compact`, `groupBy`) are not standalone APIs, even if they can be expressed through these primitives.

## D-002 — Explicit resolution of fallible utility chains

**Context.** Some collection operations can fail (range indices, invalid counts, invalid shapes), and callers need a predictable way to extract raw values.

**Decision.** Collection adapters and success-path Result helper operations produce Result-compatible fallible chains. `.else(fallback)` extracts a raw value or fallback; `.panic(message)` extracts or throws. Reuse Slang's existing mandatory `.else`-style enforcement mechanism. Runtime validation accompanies typing. Do not silently clamp or repair bad input.

**Exception.** Stepper `.next()` is allowed to return `Result` directly without mandatory terminal resolution; Stepper `.prev()` is not.

**Alternatives declined.** Raw arrays returned from fallible adapters; `.catch` as a result-preserving error transformer; automatic range clamping; truthiness-based success detection.

**Consequence.** Callers see errors where they matter, and explicit fallbacks remain concise. It requires careful type design for fluent operations without placing methods on `Err`.

## D-003 — Adapters accept raw values and verified `Ok`, not `Err`

**Context.** The user wants adapters to work both independently and alongside Result without applying collection operations to a failed value.

**Decision.** `struct(raw)` and `struct(Ok(raw))` work. `struct(Err(...))` and `struct(possibleErrResult)` do not; a possible Result must first be narrowed via `.isOk`. Repeat for `list` and `sets`.

**Alternatives declined.** Always accepting `Result` and silently skipping `Err`; only accepting raw inputs.

**Consequence.** Types express the success-only constraint. Runtime guards reject invalid casts. A separate internal fallible carrier may be needed for chaining after an adapter operation fails.

## D-004 — Three adapters with distinct purposes

**Decision.** `struct` owns object access/shaping and record indexing; `list` owns finite indexed data; `sets` owns membership and set algebra. Operations can be Result-aware and share pure internal helpers.

**Reason.** Semantic grouping reduces memorization and isolates type-specific behavior.

**Consequences.** `list.pick` is not included: field selection for every row is better expressed via `.iterate().map(...)`. Direct `get` replaces separate `first/head`, `last`, and `nth` APIs.

## D-005 — Strict list operations, signed skip, no iterator skip

**Decision.** `list.skip(2)` drops the first two; `list.skip(-2)` drops the last two. `list.range(start, end)` is a strict half-open range with negative-index normalization. Invalid bounds/counts produce errors, resolvable with `.else()` or `.panic()`. There is **no `{ bounds: true }` or automatic clamp**. `list().skip()` doesn't support generators or iterators.

**Alternatives declined.** Native `slice` permissive clamping; interpreting negative `skip` as navigation; buffering unknown-length iterators through `skip`.

**Consequence.** `list` stays finite and predictable; lazy generation uses the separate iteration/Stepper concepts.

## D-006 — `prune` uses Slang truthiness, with optional override

**Decision.** Add `prune()` to `list` and `struct` instead of `compact`. Default to Slang's existing `isFalsy` rules (not JavaScript `Boolean`): preserve `0` and `false`, discard `null`, `undefined`, empty string, NaN, and infinities. `prune(predicate)` uses the predicate instead; `true` means keep.

**Consequence.** One predictable cleansing operation covers both arrays and records, with a custom test when needed.

## D-007 — Keep `count`, `countBy`, and `keyBy` in struct

**Decision.** `count` counts own enumerable properties; `countBy` counts records by derived key; `keyBy` creates an index by derived key. Reuse an internal accumulation engine.

**Alternatives declined.** `groupBy`, `partition`, and a full family of aggregation shortcuts in V1.

**Implementation refinement.** `countBy` and `keyBy` accept an array and stringify the derived key. Duplicate `keyBy` keys are last-wins.

## D-008 — `sets(object)` refers to object keys

**Decision.** The members of `sets({ a: 1, b: 0 })` are `"a"` and `"b"`. A false/zero value doesn't remove the key. Arrays yield elements; Map yields keys; Set yields members. Internally normalize through native JavaScript `Set`.

**Alternatives declined.** Requiring `sets(Object.keys(object))`; silently using object values.

**Consequence.** Membership operations (`has`, `union`, `intersection`, `difference`, `unique`, `count`) work consistently and use native Set equality semantics.

## D-009 — `.iterate()` is an `Ok` capability

**Decision.** Expose lazy, generator-backed transformations through `.iterate()` on a successful Result. Not `rawArray.iterate()` and not a generic `list().iterate()` API. Support `map`, `filter`, `flatMap`, `take`, `drop`, `chunk`, `reduce`, `count`, and `toArray`.

**Alternatives declined.** Calling the abstraction `.toStream()` (confusion with Node/Web streams); converting every array method into a generator internally.

**Consequences.** Pipelines avoid intermediate arrays when appropriate, and final consumption remains Result-aware. Generator overhead must be benchmarked. AsyncIterable support is deferred.

## D-010 — Argument-based `memoized(fn)`, no dependencies

**Decision.** Memoize results based on function arguments only. Compare object arguments by identity. Avoid dependency arrays and reactive dependency callbacks. Offer `clear()`.

**Alternatives declined.** `memoized(() => fn, [deps])` as a reactive recomputation model; JSON-stringified argument keys.

**Consequences.** API remains simple. Thrown errors are not cached, and a rejected Promise is evicted so a later call can retry; cache growth is bounded only by `clear()` because argument-based memoization cannot know when an entry is dead.

## D-011 — Shared task groups, not runner triggers

**Decision.** Introduce a `taskGroup` scheduler accessible to separate tasks/runners. It can enforce shared concurrency, throttle starts, and later debounce queued jobs with the same key. Keep existing SuperRunner constructor and single-use `.start()` semantics. Already-running work is not cancelled by rate policies; retry attempts reacquire admission.

**Alternatives declined.** Add `runner.trigger()`; turn `superRunner.start()` into a repeatable trigger; cancel work that's already running merely because another call arrived.

**Consequence.** Scheduling becomes cross-runner without conflating scheduling and business logic. Debounce semantics need a defined pending-task result/cancellation contract.

## D-012 — Stepper is a small history engine without a default generator

**Decision.** `createStepper(config)` takes only configuration. The caller supplies a function to each `stepper.next(fn, options?)` invocation. Public members are only `next`, `prev`, `current`, and `size`. `current` is the current `Step | undefined`, `size` is the number of retained step values.

**Alternatives declined.** `createStepper(fn, options)`; permanent generator in config; `at`, `tryNext`, `tryPrev`, `forceNext`, `forcePrev`, subscriptions and built-in persistence.

**Consequence.** No hidden refetches or retained callback closures are necessary. Each forward generation is explicit.

## D-013 — Construct steps using named properties

**Decision.** The supplied constructor accepts **one object**: `make({ key: string, value: T })`. The `next` callback is `(prev, make) => ...`; the recovery callback for `prev().else` is `(prev?, make, next?) => ...`. Step keys are strings.

**Alternatives declined.** `make(key, value)` positional arguments; the confusing `next(next(...))` pattern.

**Consequence.** Shape remains extensible without positional arguments. Since `new` is a reserved JS keyword, examples use `make` for the user-chosen parameter name.

## D-014 — Uniqueness only against retained history, with optional external predicate

**Decision.** Detect duplicate steps by `key` only; don't compare values. Reject/panic on a key present in current retained history, regardless of value. A key that appeared only in evicted history is acceptable by default. Optional `keyEvalFn(key)` returns acceptance boolean and can check persisted state.

**Alternatives declined.** Deep value equality; caller-provided nonce; remembering every key forever, even with bounded `maxHistory`.

**Consequence.** Normal memory is bounded by current history. A consumer requiring lifetime/persistent uniqueness can implement external checking, but correctness across processes requires atomic external enforcement.

## D-015 — `next()` returns Result; concise opt-in fallback

**Decision.** `next(fn)` returns `Result<Step, Error>` (or Promise of it) without requiring `.else` or `.panic`. `next(fn, { fallback: true })` returns `Ok(currentStep)` on a generation failure if a current successful step exists, without advancing. Default returns `Err(error)` without advancing. Duplicate keys remain invariant panics and aren't hidden by fallback.

**Alternatives declined.** `onFail: "error" | "previous"`; mandatory `.else/.panic` on `next`; `tryNext` as a separate method.

**Consequence.** Failure behavior is opt-in with one boolean; normal callers can check the Result.

## D-016 — `prev()` is negative-offset navigation with mandatory terminal handling

**Decision.** `prev()` means `prev(-1)`, `prev(-2)` means two steps backward, and other positive/zero/fractional offsets are invalid. `prev(...).else((prev?, make, next?) => ...)` returns cached history or reconstructs an evicted target. `.panic(message)` is the strict alternative. No forced refetch of a retained step.

**Alternatives declined.** A separate `previous` source resolver; `forcePrev`; `tryPrev`; positive offsets; silent success on missing history.

**Consequence.** Historical retrieval is explicit and backward-only; callers cannot omit the error/reconstruction decision.

## D-017 — One retention budget, no extra cache configuration

**Decision.** `maxHistory` also determines how many full steps and their memoized history values are retained. `maxSteps` limits successful forward commits and defaults to `null`, meaning unlimited. `size` counts retained steps, not lifetime generated steps.

**Alternatives declined.** Separate `maxMemo`, `cache`, or argument-level callback memoization for Stepper; a global forever-growing key registry.

**Consequence.** Navigation to evicted history requires reconstruction. Key reuse after eviction is intentional, subject to optional external checking.

## D-018 — Engineering resolutions

The implementation selected the following defaults; they remain easy to revisit without breaking the public surface:

- `maxHistory` defaults to `50`.
- `prev()` before the logical first step throws; it never invents an origin.
- Moving backward and generating a new step truncates the abandoned forward branch.
- `keyBy` is last-wins; grouping keys are stringified and built with `Object.fromEntries`.
- `merge` deep-merges plain objects and replaces arrays/other values, skipping prototype-polluting keys.
- Task groups have no debounce; retries reacquire admission.
- Lazy iteration is synchronous in this release.

The following remain outside the current design agreements:

1. Concurrency / cancellation semantics for debounced pending tasks in a shared task group.
2. Atomic external uniqueness for asynchronous `keyEvalFn` (requires consumer-supplied transactional storage if global uniqueness is required).
3. Whether to expose async lazy iterators in a future release.

## Explicit exclusions

- **USSD/payment flow:** considered only as an example of an application using Stepper; not part of the Slang utility spec.
- **Stepper as generic FSM:** discarded in favor of user-controlled step generation with bounded history.
- **Forced refetch, keyed random access, state persistence:** intentionally left outside Stepper's minimal public API.
- **Full utility-list coverage:** explicitly not the goal; compact primitives supersede the candidate list.

---

**Implementation guidance:** Start with adapter typing + fallible resolution, then Stepper tests (especially duplicate keys, `prev` recovery, and eviction), then lazy iteration and scheduling groups. Test observable behavior before optimizing internal representations.
