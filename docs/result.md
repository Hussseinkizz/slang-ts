# Result

`Result` represents an operation that can succeed or fail. `Ok(value)` means success; `Err(error)`
means failure.

## What it is

A `Result` carries either a value or a human-readable error. That way a failure can travel through
normal code instead of getting thrown past the function that actually understands it.

```ts
type Result<T, E> = Ok<T> | Err<E>;
```

`Ok` can carry a message too:

```ts
const saved = Ok({ id: "123" }, "Profile saved");
if (saved.isOk) println(saved.message); // "Profile saved"
```

## When to use it

- A function has failure paths you expect: validation, a missing record, a rejected request.
- You want the caller to deal with the failure explicitly.
- You're composing steps and want to stop at the first failure.
- You want to keep a diagnostic cause around without putting it in the message the user sees.

Use `Result` for failures you expect and can recover from. When the failure is a programming error
you never intend to recover from, use [panic](panic.md) or `expect()`.

## How to use it

```ts
import { Ok, Err, type Result, println } from "slang-ts";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err("Cannot divide by zero");
  return Ok(a / b);
}

const result = divide(10, 2);

if (result.isOk) {
  println("Success:", result.value); // 5
} else {
  println("Error:", result.error);
}
```

### Async API example

```ts
type User = {
  id: string;
  name: string;
};

async function fetchUser(id: string): Promise<Result<User, string>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return Err("User not found");
    const user = await response.json();
    return Ok(user);
  } catch (error) {
    return Err("Network error", error);
  }
}

const user = await fetchUser("123");
if (user.isOk) {
  println("User:", user.value.name);
}
```

At a bigger boundary, [SafeTry](safe-try.md) can replace that `try`/`catch` and unwrap `Option` and
`Atom` values too.

### Expect and unwrap

`expect()` gives you the `Ok` value, or throws on `Err`.

```ts
const value = Ok(42).expect("must succeed");
```

You have to finish `unwrap()` with `.else(...)`. For `Err`, you get the fallback; if it's a
function, it receives the error.

```ts
const port = Ok(3000).unwrap().else(8080);
const message = Err("missing").unwrap().else((error) => `Using default: ${error}`);
```

### andThen

`andThen` transforms `Ok` and skips `Err`. If the callback returns a `Result`, it passes through as
is, never wrapped again.

```ts
Ok(10).andThen((x) => x + 5);            // Ok(15)
Err("fail").andThen((x) => x + 5);       // Err("fail") (skipped)
Ok(5).andThen((x) => Ok(x * 2));         // Ok(10) - flattened
Ok(5).andThen(() => undefined);          // Ok(5) - original
```

Async callbacks work here too:

```ts
const result = await Ok(5).andThen(async (x) => await loadValue(x));
```

### Raw cause

`Err(error, raw?)` keeps the original cause on a non-enumerable `.raw`. Users see the clean message;
your logs can still get at the cause.

```ts
const driverError = new Error("connection reset");
const failed = Err("Could not load profile", driverError);

println(failed.error); // "Could not load profile"
println(failed.raw);   // the original driver error
```

`raw` doesn't show up in `JSON.stringify`, spread, or `Object.keys`.

## Notes

- `Err` takes a string message. Keep it readable; put the technical cause in `.raw`.
- A `Result` never nests inside another `Result`. `Ok(Ok(x))` and `Ok(Err(x))` won't compile.
- `andThen` is the exception: a returned `Result` gets flattened. A returned `Result` whose own
  value is a `Result` panics.
- `andThen` catches a thrown error and gives you `Err(message)`. Return `undefined` and you keep the
  original `Ok`.
- `andThen` doesn't copy the original `Ok` message onto a new value, and `safeTry` returns a new
  `Ok` without it. Returning `undefined` keeps the original result.
- Only a successful `Ok` exposes [iterate](iterate.md). Check `.isOk` first to narrow away a
  possible `Err`.

## See also

- [SafeTry](safe-try.md)
- [Ok.iterate](iterate.md)
- [Match](match.md)
- [Pipe](pipe.md)
- [Panic](panic.md)
