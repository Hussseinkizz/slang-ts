# slang-ts agent skill

This skill tells AI agents how to work with slang-ts: its APIs, patterns, and conventions: so agents can write correct TypeScript against it.

## What slang-ts is

slang-ts is a zero-dependency functional programming library for TypeScript. It brings Rust- and Erlang-style utilities: `Option`, `Result`, `SafeTry`, pattern matching (`match`/`matchAll`), async control (`SuperPromise`, `SuperRunner`, `taskGroup`, `Signal`, `Channel`), and data helpers (`list`, `struct`, `sets`, `Ok.iterate`, `memoized`, `zip`, `pipe`, `atom`, `to`).

Import only what you use:

```ts
import { option, Ok, Err, match, superPromise, list } from "slang-ts";
```

## Core wrappers

### Option

`option(value)` → `Some(value)` or `None`. `0` and `false` count as present; `null`, `undefined`, `""`, `NaN`, and `Infinity` are `None`.

```ts
const port = option(process.env.PORT).unwrap().else(3000);
```

Never read `.value` on `None`. Check `.isSome` / `.isNone` first, or use `.unwrap().else(fallback)`.

### Result

`Ok(value, message?)` / `Err(error)`. Failures travel as values, not throws.

```ts
function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? Err("Cannot divide by zero") : Ok(a / b);
}
```

Branch with `if (result.isOk) { ... } else { ... }`. Finish chains with `.unwrap().else(fallback)` or `.unwrap().panic(message?)`.

`Err(error, raw?)` keeps the original cause on the non-enumerable `.raw` for logs; `.error` stays human-readable.

### match / matchAll

`match(result, { Ok: ..., Err: ... })` is exhaustive: TypeScript requires both cases.

`matchAll` is for strings, numbers, booleans, symbols, and `Atom`s. It always needs a `_` fallback since there's no finite set of cases.

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

- `get` already takes a fallback: `get(key, fallback)`. Do not pair `get(x, fallback)` with `.else(fallback)`: that's redundant.
- `.panic()` throws; once you panic, no custom user message is read afterward.

### list

Strict indexed arrays with `get`, `take`, `skip`, `range`, `chunk`, `count`, `prune`. Bounds are strict: out-of-range fails instead of clamping.

```ts
const page = list(users).range(start, end).else([]);
```

### struct

Safe record access and shaping. `get`, `pick`, `omit`, `merge`, `countBy`, `keyBy`.

```ts
const port = struct(config).get(["server", "port"], 3000);
```

### sets

Membership and set algebra. `has`, `unique`, `union`, `intersection`, `difference`. Objects compare by identity; primitives by value.

### Ok.iterate

Lazy pipelines over a successful `Ok`. `map`, `filter`, `flatMap`, `take`, `drop`, `chunk`, then `reduce`, `count`, or `toArray`.

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

One async operation with timeout, retry, cancellation, and `Ok`/`Err` settlement. Your function gets an `AbortSignal`.

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

Run `SuperPromise`s in sequence, parallel, or race. `start()` runs once.

```ts
const all = superRunner({ type: "all", runners: { a, b } });
const result = await all.start();
```

### taskGroup

Shared concurrency limit and start spacing across tasks. Retries wait for a new slot.

```ts
const api = taskGroup("user-api", { concurrency: 3, throttle: 200 });
const task = superPromise(fetchUsers, { group: api });
```

### Signal / Channel

`createSignal()`: a trigger that fires once (`fire()`), AbortSignal-compatible.

`createChannel()`: in-process publish/subscribe. `subscribe(topic, handler)` returns an unsubscribe function.

## Other utilities

- `atom("name")`: unique symbol with a readable description; matches in `matchAll` by description.
- `to`: convert between `Option`, `Atom`, `Result` (e.g. `option("ready").to("atom")`).
- `pipe`: run `Result`-returning steps in order, stopping at the first failure.
- `zip` / `zipWith` / `unzip`: combine parallel collections.
- `memoized`: cache a function by argument identity.
- `panic(message)`: throw immediately for unrecoverable states.
- `println`: dev logging, silent in production unless `setEnvironment` routes it.

## Conventions agents should follow

- Named params in an object for multi-arg functions, not positional.
- No classes: use functions and plain objects.
- Error categories are strings (`.category`), not numeric codes. Never call them "error codes."
- `get` accepts a fallback; don't chain `.else()` after a `get` that already has one.
- `.panic()` throws: only for unrecoverable states. Use `Result` / `.else()` for expected failures.
- Zero runtime dependencies; ESM only.

## Package contents

The published package ships `dist/` (JS + bundled declarations), `CHANGELOG.md`, and `skill/SKILL.md` (this file, for agents working with slang-ts).