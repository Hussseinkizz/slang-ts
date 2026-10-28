# Option

`option(value)` wraps a value that may or may not be present. It returns `Some(value)` when the
value is usable and `None` when it is not.

## What it is

Option is the small, explicit answer to "maybe this value exists". Use it instead of passing `null`
or `undefined` around and remembering to check at every call site.

`option()` treats these as `None`:

- `null`
- `undefined`
- `""`
- `NaN`
- `Infinity` and `-Infinity`

It treats `0` and `false` as `Some`. Those are usually intentional values, not missing ones.

## When to use it

- A config or environment value may be absent, but `0` or `false` are valid.
- A lookup can miss, and you want the miss to be explicit rather than a null check.
- You want to transform a value only when it exists.

If you need a failure reason, use [Result](result.md) instead. If the value comes from several
inconsistent sources, [Options](match.md#options) can normalize them.

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

`expect()` unwraps `Some` and throws for `None`. Use it when a missing value is a real bug.

```ts
const age = option(25).expect("A person must have an age");
println(age); // 25

// This throws.
option("").expect("A person must have an age");
```

### Unwrap with else

`unwrap()` starts a chain that must be finished with `.else(...)`. The fallback can be a value or a
function.

```ts
const port = option(process.env.PORT).unwrap().else(3000);
println("Using port:", port);

const retries = option(null).unwrap().else(() => 5);
println("Retries:", retries);
```

### Transform with andThen

`andThen` runs only for `Some` and keeps the wrapper type.

```ts
option(5).andThen((x) => x * 2);          // Some(10)
option(null).andThen((x) => x * 2);       // None (skipped)
option(5).andThen(() => undefined);       // Some(5) - original
option(42).andThen((x) => x.toString());  // Some("42")
```

Async functions are supported:

```ts
const data = await option(5).andThen(async (x) => await fetchData(x));
```

## Notes

- `Some` is the truthy path, but Slang's definition of truthy is not JavaScript's. `0` and `false`
  are present; `""`, `NaN`, and infinities are not.
- `expect()` throws for `None`. Use it for invariants you do not expect to recover from.
- `unwrap()` must be finished with `.else(...)`. Leaving it hanging throws.
- For `None`, the fallback must be truthy. `option(null).unwrap().else(0)` throws
  `"Fallback must be truthy"`.
- For `Some`, `.else(...)` is still required, but its value is ignored.
- `andThen` catches a thrown error and returns `None`. Returning `undefined` keeps the original
  `Some` instead of creating a new one.
- Passing an existing `Option` to `option()` wraps it as a value, because an object is usable. Use the
  option you already have, or `.to("option")`, when you want it unchanged.

## See also

- [Result](result.md)
- [To](to.md)
- [Match](match.md)
- [Options](match.md#options)
