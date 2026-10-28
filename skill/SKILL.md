# slang-ts agent skill

This skill tells AI agents how to work with slang-ts: its APIs, patterns, and conventions so agents can write correct TypeScript against it.

## What slang-ts is

slang-ts is a zero-dependency functional programming library for TypeScript. It brings Rust- and Erlang-style utilities: `Option`, `Result`, `SafeTry`, pattern matching (`match`/`matchAll`), async control (`SuperPromise`, `SuperRunner`, `taskGroup`, `Signal`, `Channel`), and data helpers (`list`, `struct`, `sets`, `Ok.iterate`, `memoized`, `zip`, `pipe`, `atom`, `to`).

Import only what you use:

```ts
import { option, Ok, Err, match, superPromise, list } from "slang-ts";
```

## Core wrappers

### Option

`option<T>(value): Option<T>` — wraps a value that may or may not be there.

`0` and `false` count as present; `null`, `undefined`, `""`, `NaN`, and `Infinity` are `None`.

```ts
const port = option(process.env.PORT).unwrap().else(3000);
```

Never read `.value` on `None`. Check `.isSome` / `.isNone` first, or use `.unwrap().else(fallback)`.

### Result

`Result<T, E>` is `Ok<T>` or `Err<E>`.

```ts
Ok<T>(value, message?);     // success, optional message
Err<E>(error, raw?);        // failure, optional diagnostic cause
```

`Err(error, raw?)` keeps the original cause on the non-enumerable `.raw` for logs; `.error` stays human-readable.

Branch with `if (result.isOk) { ... } else { ... }`. Finish chains with `.unwrap().else(fallback)` or `.unwrap().panic(message?)`.

```ts
function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? Err("Cannot divide by zero") : Ok(a / b);
}
```

`Result` never nests inside another `Result` — `Ok(Ok(x))` and `Ok(Err(x))` won't compile.

### match / matchAll

`match(value, patterns)` — exhaustive pattern matching for `Option` and `Result`. TypeScript requires both cases.

```ts
match(result, { Ok: (v) => ..., Err: (e) => ... });
```

`matchAll(value, patterns)` — matching for strings, numbers, booleans, symbols, and `Atom`s. Always needs a `_` fallback.

```ts
const message = matchAll(failed.category, {
  OUT_OF_BOUNDS: () => "That page is out of range.",
  _: (category) => `Unexpected failure: ${category}`,
});
```

## Collection chains (list, struct, sets, Ok.iterate)

These return a `Fallible<T>`, not a plain `Result`. Finish with `.else(fallback)` or `.panic(message?)`. On failure, `.category` holds a string like `"OUT_OF_BOUNDS"` or `"INVALID_INPUT"`.

```ts
const failed = list([1, 2, 3]).range(1, 99).take(1);
if (failed.category === "OUT_OF_BOUNDS") {
  println(failed.else([])); // []
} else {
  failed.panic(failed.category);
}
```

- `get` already takes a fallback: `get(key, fallback)`. Do not pair `get(x, fallback)` with `.else(fallback)` — that's redundant.
- `.panic()` throws; once you panic, no custom message is read afterward.

### list

`list<T>(input): ListChain<T>` — strict indexed arrays with explicit bounds. Out-of-range fails instead of clamping.

```ts
const page = list(users).range(start, end).else([]);
```

Methods: `get`, `take`, `skip`, `range`, `chunk`, `count`, `prune`.

### struct

`struct<T>(input): StructChain<T>` — safe record access and shaping.

Methods: `get`, `pick`, `omit`, `merge`, `countBy`, `keyBy`, `prune`.

```ts
const port = struct(config).get(["server", "port"], 3000);
```

- `prune` drops Slang-falsy values (`null`, `undefined`, `""`, `NaN`, `Infinity`, `-Infinity`) but keeps `0` and `false`. Its predicate receives `(value, key)` and returns `true` to keep a value. It needs a plain object.
- Wrong shape for the operation fails with `INVALID_INPUT`. A missing `get` path fails with `OUT_OF_BOUNDS`. Once a chain fails, later steps don't run, and the category survives so you can check `.category`.

### sets

`sets<T>(input): SetsChain<T>` — membership and set operations.

Methods: `has`, `unique`, `union`, `intersection`, `difference`. Objects compare by identity; primitives by value.

### Ok.iterate

`Ok<T>(value).iterate(): IterateChain<T>` — lazy pipelines over a successful `Ok`.

Methods: `map`, `filter`, `flatMap`, `take`, `drop`, `chunk`, `reduce`, `count`, `toArray`.

```ts
const names = Ok(users)
  .iterate()
  .filter((u) => u.active)
  .map((u) => u.name)
  .toArray()
  .else([]);
```

## Async

### SuperPromise

`superPromise<T>(fn, options?): SuperPromise<T>` — one async operation with start, retry, timeout, and cancel controls. Your function gets an `AbortSignal`. Tasks end as `Ok` or `Err`.

Options: `defer`, `delay`, `timeout`, `retry`, `retryUntil`, `group`.

```ts
const user = await superPromise(
  async (signal) => {
    const response = await fetch(`/api/users/${id}`, { signal });
    return response.json();
  },
  { timeout: 5000, retry: 2 },
);
```

### SuperRunner

`superRunner(config): SuperRunner<Value>` — manages several already-created `SuperPromise`s: sequence, parallel, or race. `start()` runs once.

```ts
const all = superRunner({ type: "all", runners: { a, b } });
const result = await all.start();
```

### taskGroup

`taskGroup(name, options?): TaskGroup` — shared concurrency limit and start spacing across tasks and runners. Retries wait for a new slot.

```ts
const api = taskGroup("user-api", { concurrency: 3, throttle: 200 });
const task = superPromise(fetchUsers, { group: api });
```

### Signal / Channel

`createSignal(): Signal` — a trigger that fires once (`fire()`), AbortSignal-compatible.

`createChannel(): Channel` — in-process publish/subscribe. `subscribe(topic, handler)` returns an unsubscribe function.

## Other utilities

- `atom<T>(name): Atom<T>` — unique symbol with a readable description; matches in `matchAll` by description.
- `to(target)` — convert between `Option`, `Atom`, `Result` (e.g. `option("ready").to("atom")`).
- `pipe(value, ...fns)` — run `Result`-returning steps in order, stopping at the first failure.
- `zip` / `zipWith` / `unzip` — combine parallel collections.
- `memoized(fn)` — cache a function by argument identity.
- `panic(message)` — throw immediately for unrecoverable states.
- `println` — dev logging, silent in production unless `setEnvironment` routes it.

## Conventions agents should follow

- Named params in an object for multi-arg functions, not positional.
- No classes: use functions and plain objects.
- Error categories are strings (`.category`), not numeric codes. Never call them "error codes."
- `get` accepts a fallback; don't chain `.else()` after a `get` that already has one.
- `.panic()` throws: only for unrecoverable states. Use `Result` / `.else()` for expected failures.
- Zero runtime dependencies; ESM only.

## Package contents

The published package ships `dist/` (JS + bundled declarations), `CHANGELOG.md`, and `skill/SKILL.md` (this file, for agents working with slang-ts).