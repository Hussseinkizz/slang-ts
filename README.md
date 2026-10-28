# slang-ts

[![npm version](https://img.shields.io/npm/v/slang-ts.svg)](https://www.npmjs.com/package/slang-ts)
[![license](https://img.shields.io/npm/l/slang-ts.svg)][license]

An opinionated functional programming library for TypeScript.

A collection of utilities and mechanisms brought over from languages like Rust and Erlang. Each
utility is deliberately selected and built from scratch with zero dependencies.

## Install

```bash
npm i slang-ts
```

## Why I Made This?

Well I love functional programming so much and hate classes and inheritance with all my heart, sorry no offense intended, I prefer composition and functions over those but well that's not exactly why I made this despite part of the reasons, main reason was all functional programming (FP) libraries in typescript and javascript were really complicated, think effect ts and rameda, all seemed like needed one to be so nerdy, so was like I need something simple I can work with comfortably and can onboard a team to over an evenning, one by one, got each utility crafted out, to what you see today, here I aimed more for practicality than correctness, so yes some functions are not pure, a few rules broken, a few opinions, and all that makes this fun to use, try it!

## Quick start

So let's say you have a function that can fail. Instead of throwing and hoping someone up the chain
catches it, you return a `Result`:

```ts
import { Ok, Err, type Result, println } from "slang-ts";

function divide(a: number, b: number): Result<number, string> {
  return b === 0 ? Err("Cannot divide by zero") : Ok(a / b);
}

const result = divide(10, 2);

if (result.isOk) {
  println("Result:", result.value); // 5
} else {
  println("Error:", result.error);
}
```

`println` is optional — it's a small development logger.

## Imports

Import only what you use:

```ts
import { option, Ok, Err, atom, match } from "slang-ts";
```

## Choose by problem

| If you need… | Use |
|---|---|
| A value that may be missing | [Option][option] |
| An operation that can fail | [Result][result] and [SafeTry][safe-try] |
| Pattern matching over outcomes | [Match][match] |
| Timeout, retry, or cancellation | [SuperPromise][super-promise] |
| Ordered, parallel, or race tasks | [SuperRunner][super-runner] |
| A shared concurrency limit | [taskGroup][task-group] |
| Strict array bounds or paging | [list][list] |
| Safe nested record access | [struct][struct] |
| Set membership and algebra | [sets][sets] |
| Lazy pipelines over an `Ok` | [Ok.iterate][iterate] |
| Cached function calls | [memoized][memoized] |
| Step history or undo | [createStepper][stepper] |
| Publish/subscribe between parts of an app | [Channel][channel] |
| A one-shot lifecycle trigger | [Signal][signal] |

## What's inside

### Error handling and flow

[Option][option] (Some/None, `isFalsy`, expect, unwrap/else, andThen) ·
[Result][result] (Ok/Err, expect, unwrap/else, andThen, raw cause) ·
[SafeTry][safe-try] · [Match][match] (match, matchAll) ·
[Options][options] · [Pipe][pipe]

### Composition and conversion

[Atom][atom] · [To][to] (`.to()` converters) · [Zip][zip] (zip, zipWith, unzip)

### Collections and data

[list][list] · [struct][struct] · [sets][sets] · [Ok.iterate][iterate] · [memoized][memoized]

### Async and lifecycle

[SuperPromise][super-promise] · [SuperRunner][super-runner] · [taskGroup][task-group] ·
[Signal][signal] · [Channel][channel]

### Small utilities

[Panic][panic] · [println][logging] (with `setEnvironment`) · [createStepper][stepper]

Full reference: [docs index][docs-index]. Feature list: [CHANGELOG.md][changelog].

## Real-world examples

### Load a value that can fail: SafeTry + Result

Your boundary probably mixes failures: a lookup that throws, a parser that rejects a value, an
optional result. `safeTry` brings all of that into one `Result`:

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

Without it, you'd have to catch the throw and still branch on the value:

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

Full detail: [SafeTry][safe-try] and [Result][result].

### Call an API with a timeout and retries: SuperPromise

Your executor gets an `AbortSignal`. `timeout` aborts an attempt, `retry` runs it again after an
ordinary failure, and the whole thing settles into `Ok` or `Err` — so no `try`/`catch` around the
await.

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

Full detail: [SuperPromise][super-promise].

### Page a list and shape records: list + struct

`list` keeps bounds strict: a bad range fails instead of quietly giving you less data. `struct`
reads and shapes records without spreading fields you didn't choose.

```ts
import { list, struct, println } from "slang-ts";

type User = {
  id: string;
  name: string;
  avatar?: string;
  email: string;
};

const users: User[] = await getUsers(); // your data source

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

`list` won't clamp a range for you, so the example clamps the window and lets the last page be
short. `struct` then keeps only the fields the card needs.

Full detail: [list][list] and [struct][struct].

## Development

Install with Bun, then run the release check:

```bash
bun install
bun run export
```

`export` runs the tests, checks types, and builds minified ESM with bundled declarations into
`dist/`. `npm publish` runs it through `prepublishOnly`, so you never ship stale output. Tests live
in [tests](https://github.com/Hussseinkizz/slang/tree/main/tests).

Building needs Node.js `^22.18.0 || ^24.11.0 || >=26.0.0`. That's for the build tool, not for
projects using Slang.

## Contributing

Got a utility from another language that belongs here? Open an issue or a pull request.
Contributions are welcome.

## Requirements

- ESM only. You'll use `import`; `require` isn't supported.
- Node.js 20+ or a modern browser.
- TypeScript 5.9.x or 7.0.x if you want the bundled types. Plain JavaScript works too.
- Zero runtime dependencies.

## License

MIT License. See [LICENSE][license] for the full text.

[option]: https://github.com/Hussseinkizz/slang/blob/main/docs/option.md
[result]: https://github.com/Hussseinkizz/slang/blob/main/docs/result.md
[safe-try]: https://github.com/Hussseinkizz/slang/blob/main/docs/safe-try.md
[match]: https://github.com/Hussseinkizz/slang/blob/main/docs/match.md
[options]: https://github.com/Hussseinkizz/slang/blob/main/docs/match.md#options
[pipe]: https://github.com/Hussseinkizz/slang/blob/main/docs/pipe.md
[atom]: https://github.com/Hussseinkizz/slang/blob/main/docs/atom.md
[to]: https://github.com/Hussseinkizz/slang/blob/main/docs/to.md
[zip]: https://github.com/Hussseinkizz/slang/blob/main/docs/zip.md
[list]: https://github.com/Hussseinkizz/slang/blob/main/docs/list.md
[struct]: https://github.com/Hussseinkizz/slang/blob/main/docs/struct.md
[sets]: https://github.com/Hussseinkizz/slang/blob/main/docs/sets.md
[iterate]: https://github.com/Hussseinkizz/slang/blob/main/docs/iterate.md
[memoized]: https://github.com/Hussseinkizz/slang/blob/main/docs/memoized.md
[super-promise]: https://github.com/Hussseinkizz/slang/blob/main/docs/super-promise.md
[super-runner]: https://github.com/Hussseinkizz/slang/blob/main/docs/super-runner.md
[task-group]: https://github.com/Hussseinkizz/slang/blob/main/docs/task-group.md
[signal]: https://github.com/Hussseinkizz/slang/blob/main/docs/signal.md
[channel]: https://github.com/Hussseinkizz/slang/blob/main/docs/channel.md
[panic]: https://github.com/Hussseinkizz/slang/blob/main/docs/panic.md
[logging]: https://github.com/Hussseinkizz/slang/blob/main/docs/logging.md
[stepper]: https://github.com/Hussseinkizz/slang/blob/main/docs/stepper.md
[docs-index]: https://github.com/Hussseinkizz/slang/blob/main/docs/README.md
[changelog]: https://github.com/Hussseinkizz/slang/blob/main/CHANGELOG.md
[license]: https://github.com/Hussseinkizz/slang/blob/main/LICENSE
