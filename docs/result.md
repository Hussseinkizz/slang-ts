# Result

`Result` represents an operation that can succeed or fail. `Ok(value)` is success; `Err(error)` is
failure.

## What it is

A `Result` carries either a value or a human-readable error. It lets failures travel through normal
code instead of being thrown past the function that understands them.

```ts
type Result<T, E> = Ok<T> | Err<E>;
```

`Ok` can also carry a message:

```ts
const saved = Ok({ id: "123" }, "Profile saved");
if (saved.isOk) println(saved.message); // "Profile saved"
```

## When to use it

- A function has expected failure paths: validation, a missing record, a rejected request.
- You want the caller to handle failure explicitly.
- You are composing steps and want to stop at the first failure.
- You want a failure to keep a diagnostic cause without putting it in the user-facing message.

Use `Result` for recoverable, expected failures. Use [panic](panic.md) or `expect()` when the
failure is a programming error you do not intend to recover from.

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

At a larger boundary, [SafeTry](safe-try.md) can replace that `try`/`catch` and also unwrap
`Option` and `Atom` values.

### Expect and unwrap

`expect()` returns the `Ok` value or throws for `Err`.

```ts
const value = Ok(42).expect("must succeed");
```

`unwrap()` must be finished with `.else(...)`. For `Err`, the fallback is returned; if it is a
function, it receives the error.

```ts
const port = Ok(3000).unwrap().else(8080);
const message = Err("missing").unwrap().else((error) => `Using default: ${error}`);
```

### andThen

`andThen` transforms `Ok` and skips `Err`. If the callback returns a `Result`, it is passed through
as is, never wrapped again.

```ts
Ok(10).andThen((x) => x + 5);            // Ok(15)
Err("fail").andThen((x) => x + 5);       // Err("fail") (skipped)
Ok(5).andThen((x) => Ok(x * 2));         // Ok(10) - flattened
Ok(5).andThen(() => undefined);          // Ok(5) - original
```

It supports async callbacks:

```ts
const result = await Ok(5).andThen(async (x) => await loadValue(x));
```

### Raw cause

`Err(error, raw?)` keeps the original cause on a non-enumerable `.raw`. The message stays clean for
users; the cause stays available for logs.

```ts
const driverError = new Error("connection reset");
const failed = Err("Could not load profile", driverError);

println(failed.error); // "Could not load profile"
println(failed.raw);   // the original driver error
```

`raw` is not included in `JSON.stringify`, spread, or `Object.keys`.

## Notes

- `Err` takes a string message. Keep it human-readable; put the technical cause in `.raw`.
- A `Result` never nests inside another `Result`. `Ok(Ok(x))` and `Ok(Err(x))` do not compile.
- `andThen` is the exception: a returned `Result` is flattened. A returned `Result` whose own value
  is a `Result` panics.
- `andThen` catches a thrown error and returns `Err(message)`. Returning `undefined` keeps the
  original `Ok`.
- `andThen` does not copy the original `Ok` message onto a new value, and `safeTry` returns a new
  `Ok` without it. Returning `undefined` keeps the original result.
- Only a successful `Ok` exposes [iterate](iterate.md). Narrow a possible `Err` with `.isOk` first.

## See also

- [SafeTry](safe-try.md)
- [Ok.iterate](iterate.md)
- [Match](match.md)
- [Pipe](pipe.md)
- [Panic](panic.md)
