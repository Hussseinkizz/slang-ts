# slang-ts

An opinionated functional programming library for TypeScript.

A collection of utilities and mechanisms brought over from languages like Rust and Erlang.

Each utility is deliberately chosen and built from scratch with zero dependencies.

## Install

```bash
npm i slang-ts
```

## Implemented Utilities

- [x] Option (Some, None)
- [x] isFalsy (Option truthiness check)
- [x] Result (Ok, Err)
- [x] Expect
- [x] Unwrap (on Option)
- [x] Else (on unwrap)
- [x] andThen
- [x] Match
- [x] MatchAll
- [x] Options (normalize mixed values)
- [x] SafeTry
- [x] Pipe
- [x] To (converters, e.g. `userAtom.to('option')`)
- [x] Atom
- [x] Zip, Unzip, zipWith
- [x] Panic
- [x] println (environment-aware logging)
- [x] Signal (lifecycle trigger)
- [x] SuperPromise (abort, reject, resolve, defer)
- [x] SuperRunner (sequence, all, race)
- [x] Channel (send, subscribe, when)
- [x] list (strict indexed collections)
- [x] struct (safe access, shaping, grouping)
- [x] sets (membership and set algebra)
- [x] Ok.iterate (lazy collection pipeline)
- [x] memoized (argument-based caching)
- [x] taskGroup (shared concurrency and start spacing)
- [x] createStepper (bounded keyed history)

All utilities are covered by the test suite. See [tests](https://github.com/Hussseinkizz/slang/tree/main/tests).

## What's new in 0.0.1 – 0.2.0

Slang grew from Option, Result, and SafeTry into a toolkit: `match` and `pipe` for flow, `atom`, `to`,
and `zip` for composition, and `list`, `struct`, `sets`, `iterate`, and `memoized` for data. Async
work covers `SuperPromise`, `SuperRunner`, `taskGroup`, `Signal`, and `Channel`, with `createStepper`
for keyed history.

Optional `Ok` success messages arrived in 0.1.1. Version 0.2.0 added the collection utilities,
`createStepper`, and shared task scheduling.

## Imports

Import only what you use:

```ts
import { option, Ok, Err, atom, match } from "slang-ts";
```

Or import the namespace:

```ts
import * as slang from "slang-ts";

slang.println("Hello world!");
```

## Explore by category

### Error handling and flow

Turn failures into values, match them, and compose steps.

[Option](docs/option.md) · [Result](docs/result.md) · [SafeTry](docs/safe-try.md) · [Match](docs/match.md) · [Options](docs/match.md#options) · [Pipe](docs/pipe.md)

### Composition and conversion

Unique named values, converters, and aligned collections.

[Atom](docs/atom.md) · [To](docs/to.md) · [Zip](docs/zip.md)

### Collections and data

Strict collections, safe record access, set algebra, lazy pipelines, and caching.

[list](docs/list.md) · [struct](docs/struct.md) · [sets](docs/sets.md) · [Ok.iterate](docs/iterate.md) · [memoized](docs/memoized.md)

### Async and lifecycle

Timeouts, retries, cancellation, concurrency, and event wiring.

[SuperPromise](docs/super-promise.md) · [SuperRunner](docs/super-runner.md) · [taskGroup](docs/task-group.md) · [Signal](docs/signal.md) · [Channel](docs/channel.md)

### Small utilities

Fail fast, log quietly, and navigate keyed history.

[Panic](docs/panic.md) · [println](docs/logging.md) · [createStepper](docs/stepper.md)

Full index: [docs](docs/README.md).

For the current API in one file, see [example.ts](https://github.com/Hussseinkizz/slang/blob/main/example.ts).

## Real-world examples

### Load a value that can fail: SafeTry + Result

A boundary often mixes failures: a lookup that throws, a parser that rejects a value, an optional result. `safeTry` brings them into one `Result`:

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

Without it, the caller has to catch the throw and still branch on the value:

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

Full detail: [SafeTry](docs/safe-try.md) and [Result](docs/result.md).

### Call an API with a timeout and retries: SuperPromise

The executor receives an `AbortSignal`. `timeout` aborts an attempt, `retry` repeats an ordinary
failure, and the task settles into `Ok` or `Err`, so there is no `try`/`catch` around the await.

```ts
import { superPromise, println } from "slang-ts";

const id = "123";

const user = await superPromise(
  async (signal) => {
    const response = await fetch(`/api/users/${id}`, { signal });
    if (!response.ok) throw new Error("User not found");
    return (await response.json()) as { name: string };
  },
  { timeout: 5000, retry: 2 },
);

if (user.isOk) {
  println("User:", user.value.name);
} else {
  println("Could not load user:", user.error);
}
```

Full detail: [SuperPromise](docs/super-promise.md).

### Page a list and shape records: list + struct

`list` keeps bounds strict: a bad range fails instead of quietly returning less data. `struct`
reads and shapes records without spreading fields you did not choose.

```ts
import { list, struct, println } from "slang-ts";

type User = {
  id: string;
  name: string;
  avatar?: string;
  email: string;
};

const users: User[] = await getUsers();

const page = 2;
const size = 20;
const total = list(users).count().else(0);
const start = Math.min(page * size, total);
const paged = list(users)
  .range(start, Math.min(start + size, total))
  .else([]);

const cards = paged.map((user) =>
  struct(user).pick("id", "name", "avatar").else(user),
);

println(cards);
```

`list` does not clamp a range for you, so the example clamps the window and lets the last page be
short. `struct` then keeps only the fields the card needs.

Full detail: [list](docs/list.md) and [struct](docs/struct.md).

## Development

Install dependencies with Bun, then run the release check:

```bash
bun install
bun run export
```

`export` runs the tests, checks types, and builds minified ESM with bundled declarations into `dist/`.
`npm publish` runs it through `prepublishOnly`, so a release never ships stale output.

Building requires Node.js `^22.18.0 || ^24.11.0 || >=26.0.0`. This applies to the build tool, not to
projects using Slang.

## Contributing

Contributions are welcome. If there is a utility from another language that belongs here, open an
issue or a pull request.
