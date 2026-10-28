# SafeTry

`safeTry` runs a sync or async function and captures failures as `Err<string>`. It also unwraps
Slang wrappers into one `Result`.

## What it is

Use `safeTry` at a boundary where several things can fail: a fetch, a parser, a database call, an
optional lookup. Instead of scattering `try`/`catch` and null checks, the function returns one
`Result` the caller can inspect.

It is most useful when the failures arrive in different shapes: a thrown error, a `Result`, an
`Option`, or an `Atom`.

## When to use it

- A function mixes throws, `Result`s, `Option`s, or `Atom`s.
- You want one failure shape at the edge of a feature.
- You are calling async code and do not want its errors to escape as rejections.

For a single `Result`-returning function, plain `Result` is enough. `safeTry` earns its place at
the boundary where several shapes meet.

## How to use it

The boundary is easiest to see next to the code it replaces. A lookup can throw; a parser can
reject a value. Plain TypeScript makes the caller handle both:

```ts
type Role = "admin" | "member";

function loadRole(): Role {
  const saved = localStorage.getItem("role");
  if (saved === null) throw new Error("No role saved");
  if (saved !== "admin" && saved !== "member") throw new Error("Unknown role");
  return saved;
}

try {
  const role = loadRole();
  console.log("Role:", role);
} catch (error) {
  console.log(
    "Could not load role:",
    error instanceof Error ? error.message : "Unknown error",
  );
}
```

With `safeTry`, the lookup can still throw and the parser can return `Err`; both arrive as one
`Result`:

```ts
import { Err, Ok, safeTry, type Result, println } from "slang-ts";

type Role = "admin" | "member";

function parseRole(value: string): Result<Role, string> {
  return value === "admin" || value === "member"
    ? Ok(value)
    : Err("Unknown role");
}

const role = await safeTry(() => {
  const saved = localStorage.getItem("role");
  if (saved === null) throw new Error("No role saved");
  return parseRole(saved);
});

if (role.isOk) {
  println("Role:", role.value);
} else {
  println("Could not load role:", role.error);
}
```

### Unwrapping wrappers

`safeTry` also unwraps Slang wrappers, so a returned `Option` or `Atom` does not need its own
branch.

```ts
import { safeTry, Ok, option, atom, println } from "slang-ts";

// Option and Atom layers unwrap; the terminal value is inferred, never nested.
const unwrapped = await safeTry(() => Ok(option(42)));
if (unwrapped.isOk) println(unwrapped.value); // 42

const mixed = await safeTry(() => Ok(option(atom("ready"))));
// Ok("ready"); the inferred success value is the literal "ready".
if (mixed.isOk) println(mixed.value); // "ready"

const missing = await safeTry(() => Ok(option(null))); // Err("Option was None")
if (missing.isErr) println(missing.error);

const caught = await safeTry(async () => {
  throw new Error("Could not load profile");
}); // Err("Could not load profile")
if (caught.isErr) println(caught.error);
```

Always await it. It returns a promise even when the callback is synchronous.

### What unwraps and what stays

Only the returned wrapper chain unwraps. Plain object properties and array elements stay as
supplied. Only the callback's return is awaited; a Promise inside `Ok` or `Some` stays a Promise.

```ts
import { safeTry, Ok, println } from "slang-ts";

const payload = { result: Ok(42), items: [Ok(7)] };
const plain = await safeTry(() => payload); // Ok(payload), same object
if (plain.isOk) println(plain.value === payload); // true

const innerPromise = Promise.resolve(42);
const wrapped = await safeTry(() => Ok(innerPromise));
// Ok(innerPromise), success value stays Promise<number>.
if (wrapped.isOk) println(wrapped.value === innerPromise); // true
```

### Throwing instead of returning

`{ throw: true }` rethrows errors caught while running the callback or reading its returned
wrappers. Returned `Err` values still return normally. A circular wrapper chain returns
`Err("Cannot resolve a circular value")`, including with `{ throw: true }`.

```ts
import { safeTry, Ok, Err, println } from "slang-ts";

const returned = await safeTry(() => Err("Not found"), { throw: true });
if (returned.isErr) println(returned.error); // "Not found"

await safeTry(() => {
  throw new Error("Critical failure");
}, { throw: true }).catch((error: Error) => println(error.message));
// "Critical failure": the call rejects instead of returning Err.
```

### Collected layers

`{ collectValues: true }` records the layers it walks and any failure on the returned `Result`'s
non-enumerable `.raw`, shaped `{ errors, values }`. It is diagnostic data for logs, not a formatted
message for users.

## Notes

- The returned `Result` is always a promise. Missing an `await` gives you a promise, not an
  inspectable result.
- `None` becomes `Err("Option was None")`. An `Atom` becomes its description.
- A caught throw keeps the thrown value on `.raw` unless `{ collectValues: true }` replaces it.
- Nested `Result` values are rejected at the type level and panic at runtime if they slip in
  through untyped data.

## See also

- [Result](result.md)
- [Option](option.md)
- [Pipe](pipe.md)
- [Match](match.md)
