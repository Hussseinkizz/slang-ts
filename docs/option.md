# Option

`option(value)` — wraps a value that may or may not be there. You get `Some(value)` when usable,
`None` when it isn't.

```ts
// Signature
type Option<T> = Some<T> | None;

/* Constructor */
option<T>(value: T | null | undefined | "" | NaN | Infinity | -Infinity): Option<T>;
/*   → Some<T> for truthy values (0 and false count as present)
   → None   for null, undefined, "", NaN, Infinity, -Infinity */

/* Methods */
option.unwrap().else(fallback);   // T — the inner value, or a truthy fallback for None
option.expect(msg?);              // T — throws on None
option.andThen(fn);               // transforms Some, skips None; undefined keeps the original
option.to(target);              // "atom" | "option" | "result" — convert between wrappers
```

`0` and `false` come back as `Some` — you usually set those on purpose, so they aren't treated as
missing. `None` has no `.value`; check `.isSome` / `.isNone` first, or use `.unwrap().else(...)`.

## What it is

Option is a small, explicit way to say "maybe this value exists". Use it instead of passing `null`
or `undefined` around and hoping every call site remembers to check.

`option()` gives you `None` for these:

- `null`
- `undefined`
- `""`
- `NaN`
- `Infinity` and `-Infinity`

`0` and `false` come back as `Some`. You usually set those on purpose, so they aren't treated as
missing.

## When to use it

- A config or environment value might be absent, but `0` or `false` are valid values.
- A lookup can miss, and you'd rather handle the miss explicitly than write another null check.
- You only want to transform a value when it's actually there.

If you need a reason for the failure, use [Result](result.md) instead. If the value comes from
several sources with inconsistent shapes, [Options](match.md#options) can normalize them.

## How to use it

```ts
import { option, println } from "slang-ts";

const a = option("hi");   // Some("hi")
const b = option(null);   // None
const c = option(0);      // Some(0) - zero is present
const d = option("");     // None
const e = option(false);  // Some(false) - false is present

if (a.isSome) {
  println("Value:", a.value);
}

if (b.isNone) {
  println("No value");
}
```

### Expect

`expect()` gives you the `Some` value and throws on `None`. Use it when a missing value means
something is actually broken.

```ts
const age = option(25).expect("A person must have an age");
println(age); // 25

// This throws.
option("").expect("A person must have an age");
```

### Unwrap with else

`unwrap()` starts a chain you have to finish with `.else(...)`. The fallback can be a value or a
function.

```ts
const port = option(process.env.PORT).unwrap().else(3000);
println("Using port:", port);

const retries = option(null).unwrap().else(() => 5);
println("Retries:", retries);
```

### Transform with andThen

`andThen` only runs for `Some`, and you still get an `Option` back.

```ts
option(5).andThen((x) => x * 2);          // Some(10)
option(null).andThen((x) => x * 2);       // None (skipped)
option(5).andThen(() => undefined);       // Some(5) - original
option(42).andThen((x) => x.toString());  // Some("42")
```

Async callbacks work too:

```ts
const data = await option(5).andThen(async (x) => await fetchData(x));
```

## Technical Notes

- `Some` is the truthy path, but Slang's idea of truthy isn't JavaScript's. `0` and `false` count
  as present; `""`, `NaN`, and the infinities don't.
- `expect()` throws on `None`. Save it for invariants you don't plan to recover from.
- You have to finish `unwrap()` with `.else(...)`. Leave it hanging and it throws.
- For `None`, the fallback has to be truthy. `option(null).unwrap().else(0)` throws
  `"Fallback must be truthy"`.
- For `Some`, you still need `.else(...)`, but its value is ignored.
- `andThen` catches a thrown error and gives you `None`. Return `undefined` and you keep the
  original `Some` instead of getting a new one.
- If you pass an existing `Option` to `option()`, it gets wrapped as a value, since an object counts
  as usable. Use the option you already have, or `.to("option")`, when you want it unchanged.

## See also

- [Result](result.md)
- [To](to.md)
- [Match](match.md)
- [Options](match.md#options)
