# Match

`match` handles `Option` and `Result` exhaustively. `matchAll` handles literals and `Atom`s with a
required `_` fallback.

## What it is

`match` takes a value and an object of handlers. It returns the value from the handler that runs.
TypeScript requires every case, so adding a new variant forces the call site to deal with it.

`matchAll` does the same for strings, numbers, booleans, and `Atom` descriptions. It always
requires `_`, because there is no finite set of cases to exhaust.

## When to use it

- You are choosing a value from an `Option` or `Result` and want both branches handled.
- You want a readable label or action per state, without `if`/`else` chains.
- You are mapping an `Atom` or literal state to a message, route, or handler.

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

`Options` normalizes heterogeneous values (raw values, `Option`s, and `Result`s) into a single
`Result`. It returns the first usable value as `Ok`, or the fallback `Err` if none is usable.

A value is usable when its unwrapped inner value is truthy. `None`, `Err`, `null`, `undefined`,
empty strings, `NaN`, and infinities are skipped. `0` and `false` are usable, matching `option()`
semantics.

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

Use it when values come from different functions with inconsistent return types and all you care
about is whether the end result is usable.

## Notes

- `match` requires both cases. Missing one throws
  `"Non-exhaustive match — missing handler for '<type>'"`.
- `matchAll` requires `_`. It is the fallback, not an optional nicety.
- `matchAll` uses an `Atom`'s description as its key. A plain symbol works too.
- `matchAll` accepts strings, numbers, booleans, and symbols. Objects, arrays, and functions throw.
- Boolean and number keys are compared as object property names, so `true` and `1` line up with
  `"true"` and `"1"`.
- Handlers receive the original wrapper for `match`, so use `value.value` or `error.error`.
- `Options` takes an optional fallback; the default is `Err("No value!")`.

## See also

- [Option](option.md)
- [Result](result.md)
- [Atom](atom.md)
