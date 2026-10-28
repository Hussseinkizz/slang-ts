# Match

`match(value, patterns)` — exhaustive pattern matching for `Option` and `Result`.
`matchAll(value, patterns)` — matching for literals and `Atom`s (always needs a `_` fallback).

```ts
// Signature
match<T, E, R>(value: Result<T, E>, patterns: { Ok: (v: Ok<T>) => R; Err: (e: Err<E>) => R }): R;
match<T, R>(value: Option<T>, patterns: { Some: (v: Some<T>) => R; None: () => R }): R;

/* matchAll — strings, numbers, booleans, Atoms; `_` fallback is required */
matchAll<T extends string | number | boolean | Atom, R>(
  value: T,
  patterns: { [key in T]?: (v: T) => R; _: () => R },
): R;
```

`match` requires both `Ok` and `Err` (or `Some` and `None`) handlers — TypeScript enforces
exhaustiveness, so adding a new variant forces every call site to handle it. Handlers receive the
original wrapper, so use `value.value` or `error.error`.

`matchAll` matches by semantic name: strings and numbers by value, booleans as `"true"`/`"false"`,
and `Atom`s by their description. It always needs a `_` default handler since there's no finite set
of cases.

## What it is

`match` takes a value and an object of handlers. The matching handler runs, and you get its return
value back. TypeScript requires every case, so when a new variant shows up, the call site has to
deal with it.

`matchAll` does the same for strings, numbers, booleans, and `Atom` descriptions. It always needs
`_`, because there's no finite set of cases to exhaust.

## When to use it

- You're picking a value out of an `Option` or `Result` and want both branches handled.
- You want a readable label or action per state, without an `if`/`else` chain.
- You're mapping an `Atom` or literal state to a message, route, or handler.

## How to use it

### Result and Option

```ts
import { match, option, Ok, Err, type Result, println } from "slang-ts";

function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? Err("Cannot divide by zero") : Ok(a / b);
}

const result = divide(10, 0);
const message = match(result, {
  Ok: (value) => `Success: ${value.value}`,
  Err: (error) => `Failed: ${error.error}`,
});
println(message); // "Failed: Cannot divide by zero"

const maybePort = option(process.env.PORT);
const port = match(maybePort, {
  Some: (value) => parseInt(value.value),
  None: () => 3000,
});
println("Using port:", port); // parsed port, or 3000
```

### Error categories

Collection chains (`list`, `struct`, `sets`, `Ok.iterate`) carry a
`.category` string on failure. Use `matchAll` to turn a known category
into a user-facing message:

```ts
import { list, matchAll, println } from "slang-ts";

const failed = list([1, 2, 3]).range(1, 99).take(1);

const message = matchAll(failed.category, {
  OUT_OF_BOUNDS: () => "That page is out of range.",
  INVALID_INPUT: () => "That input isn't an array.",
  _: (category) => `Unexpected failure: ${category}`,
});

println(message); // "That page is out of range."
```

For anything you can't handle with a fallback, check `.category` first
and panic with the category itself — once you panic, a custom user
message is never read. See [list](list.md#failures-and-categories).

`matchAll` needs the `_` fallback since there's no finite set of category
strings to exhaust.

### Literals and atoms

```ts
import { atom, matchAll, println } from "slang-ts";

const ready = atom("ready");
const status = matchAll(ready, {
  ready: () => "System is ready",
  failed: () => "System failed",
  _: () => "Unknown state",
});
println(status); // "System is ready"

const isActive = true;
const label = matchAll(isActive, {
  true: () => "Active",
  false: () => "Inactive",
  _: () => "Unknown",
});
println(label); // "Active"
```

## Options

`Options` takes a mix of raw values, `Option`s, and `Result`s and normalizes them into one
`Result`. You get the first usable value as `Ok`, or the fallback `Err` when nothing is usable.

A value is usable when its unwrapped inner value is truthy. `None`, `Err`, `null`, `undefined`,
empty strings, `NaN`, and infinities get skipped. `0` and `false` count as usable, same as
`option()`.

```ts
import { Options, option, Ok, Err } from "slang-ts";

// First usable value wins.
const a = null;
const b = option(undefined);
const c = Ok(true);
const d = Err("nope!");

const something = Options([a, b, c, d], Err("No value!"));
// Ok(true) - c is usable

// Nothing usable -> fallback.
const e = option(null);
const nothing = Options([a, b, e, d], Err("No value!"));
// Err("No value!")

// Raw values work too, just like a single option().
Options([null, undefined, "hello"]); // Ok("hello")
Options(["", 0, "later"]);           // Ok(0) - zero is usable
Options([null, undefined, ""]);      // Err("No value!")
```

Reach for it when values come from different functions with inconsistent return types, and all you
care about is whether the end result is usable.

## Notes

- `match` requires both cases. Miss one and it throws
  `"Non-exhaustive match — missing handler for '<type>'"`.
- `matchAll` requires `_`. It's the fallback, not an optional nicety.
- `matchAll` uses an `Atom`'s description as its key. A plain symbol works too.
- `matchAll` accepts strings, numbers, booleans, and symbols. Objects, arrays, and functions throw.
- Boolean and number keys get compared as object property names, so `true` and `1` line up with
  `"true"` and `"1"`.
- For `match`, handlers receive the original wrapper, so use `value.value` or `error.error`.
- `Options` takes an optional fallback. The default is `Err("No value!")`.

## See also

- [Option](option.md)
- [Result](result.md)
- [Atom](atom.md)
