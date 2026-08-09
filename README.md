# slang-ts

Functional programming library for TypeScript.

A collection of utilities and other cool programming stuff brought over from languages like Rust.

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
- [x] setEnvironment (logging mode, custom logger)
- [x] Signal (lifecycle trigger)
- [x] SuperPromise (abort, reject, resolve, defer)
- [x] SuperRunner (sequence, all, race)
- [x] Channel (send, subscribe, when)
- [x] scheduleMicrotask (internal scheduling helper)

All utilities fully tested. See [tests](https://github.com/Hussseinkizz/slang/tree/main/tests)

## New in v0.0.8

- **Signal**: a simple on/off trigger that fires once and stays fired; use it to make something start only after something else finishes.
- **println now respects the environment**: `setEnvironment("production")` (or `"prod"`) turns it into a no-op, so dev logging never reaches prod logs; short forms `dev`/`prod` accepted, and it appends a real newline. Pass `{ printFn }` to route println through an existing logger instead.
- **SuperPromise**: native JavaScript promises plus wait, retry, time out, cancel, settling into `Ok`/`Err`; use it for any async operation that needs more than plain promise.
- **SuperRunner**: `Promise.all` and `Promise.race` grown up: run several SuperPromises in order, in parallel, or take first to finish.
- **Channel**: a simple event bus between parts of your app that don't need to know each other; use it to broadcast things like "user created" or "workflow completed" without wiring components together.

## How It Works

Import utilities individually or together:

```ts
// Individual imports
import { option } from "slang-ts";
import { Ok, Err } from "slang-ts";

// Or import multiple at once
import { option, Ok, Err, atom, match } from "slang-ts";

// Or import under namespace (not so performant)
import * as slang from "slang-ts";

slang.println("Hello world!");
```

### Option

Wraps values that may or may not be present. Returns `Some<T>` for truthy values, `None` for null, undefined, empty strings, NaN, or Infinity. Note that `0` and `false` are truthy as these are usually intentional.

```ts
import { option } from "slang-ts";

const a = option("hi");      // Some("hi")
const b = option(null);      // None
const c = option(0);         // Some(0) - zero is truthy!
const d = option("");        // None
const e = option(false);     // Some(false) - false is truthy!

if (a.isSome) {
  println("Value:", a.value);
}

if (b.isNone) {
  println("No value");
}
```

### Result

Represents operations that can succeed or fail. Returns `Ok<T>` on success or `Err<E>` on failure with typed error payload.

```ts
import { Ok, Err, type Result } from "slang-ts";

// Simple function returning Result
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

// Async API example
interface User {
  id: string;
  name: string;
}

async function fetchUser(id: string): Promise<Result<User, string>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) return Err("User not found");
    const user = await response.json();
    return Ok(user);
  } catch (error) {
    return Err("Network error");
  }
}

const user = await fetchUser("123");
if (user.isOk) {
  println("User:", user.value.name);
}
```

### Expect

Unwraps values or throws with custom message. Use when failure is unrecoverable.

```ts
const personAge = option(25).expect("a person must have age!");
println("person age", personAge); // 25

// This would throw!
// const personAge2 = option("").expect("a person must have age!");
```

### Unwrap/Else

Chainable unwrapping with mandatory fallback. Must call `.else()` or throws.

```ts
const port = option(process.env.PORT).unwrap().else(3000);
println("Using port:", port);

// Function fallbacks
const retries = option(null).unwrap().else(() => 5);
println("Retries:", retries);

// This throws! No .else() chained
// const nothing = option(null).unwrap();
```

### andThen

Chainable transformation for `Option`, `Result`, and `Atom`. Transforms the inner value while preserving the wrapper type. Returns original instance if provided transformation function returns `undefined`.

```ts
// Option - transforms Some, skips None
option(5).andThen(x => x * 2);              // Some(10)
option(null).andThen(x => x * 2);           // None (skipped)
option(5).andThen(() => undefined);         // Some(5) - original

// Result - transforms Ok, skips Err
Ok(10).andThen(x => x + 5);                 // Ok(15)
Err("fail").andThen(x => x + 5);            // Err("fail") (skipped)

// Atom - transforms description (sync only)
atom("hello").andThen(s => s.toUpperCase()); // Atom("HELLO")

// Chained andThen - multiple transformations
option(5)
  .andThen(x => x + 1)
  .andThen(x => x * 2)
  .andThen(x => x.toString());              // Some("12")

Ok(10)
  .andThen(x => x * 2)
  .andThen(x => x + 5)
  .andThen(x => ({ value: x }));            // Ok({ value: 25 })

atom("hello")
  .andThen(s => s.toUpperCase())
  .andThen(s => s + "!");                   // Atom("HELLO!")

// Async support for Option and Result
const data = await option(5).andThen(async x => await fetchData(x));

// Error handling
option(5).andThen(() => { throw "oops" });  // None (caught)
Ok(5).andThen(() => { throw "oops" });      // Err("oops")
atom("x").andThen(() => { throw "oops" });  // Panics!

// Type transformation
option(42).andThen(x => x.toString());      // Some("42")
```

### Match

Exhaustive pattern matching for `Option` and `Result` types. Forces you to handle all cases. Returns the value from the matched handler.

```ts
import { match } from "slang-ts";

// Matching Results - returns handler result
const result = divide(10, 0);
const message = match(result, {
  Ok: (v) => `Success: ${v.value}`,
  Err: (e) => `Failed: ${e.error}`,
});
println(message); // "Failed: Cannot divide by zero"

// Matching Options - returns handler result
const maybePort = option(process.env.PORT);
const port = match(maybePort, {
  Some: (v) => parseInt(v.value),
  None: () => 3000,
});
println("Using port:", port); // Uses parsed port or default 3000
```

### MatchAll

Pattern matching for primitives and atoms with required `_` fallback. Returns the value from the matched handler.

```ts
import { matchAll } from "slang-ts";

// Match atoms - returns handler result
const ready = atom("ready");
const status = matchAll(ready, {
  ready: () => "System is ready",
  failed: () => "System failed",
  _: () => "Unknown state",
});
println(status); // "System is ready"

// Match booleans - returns handler result
const isActive = true;
const label = matchAll(isActive, {
  true: () => "Active",
  false: () => "Inactive",
  _: () => "Unknown",
});
println(label); // "Active"
```

### Options

Normalizes heterogeneous values (raw values, `Option`s, and `Result`s) into a single `Result`. Returns the first usable value as `Ok`, or the provided `Err` fallback if none is usable. A value is usable when its unwrapped inner value is truthy; `None`, `Err`, null, undefined, empty strings, NaN, and Infinity are skipped (note `0` and `false` are usable, matching `option()` semantics).

```ts
import { Options, option, Ok, Err } from "slang-ts";

// First usable value wins
let a = null;
let b = option(undefined);
let c = Ok(true);
let d = Err("nope!");

const something = Options([a, b, c, d], Err("No value!"));
// Ok(true) - c is usable

// Nothing usable -> fallback
let e = option(null);
const nothing = Options([a, b, e, d], Err("No value!"));
// Err("No value!")

// Raw (non-wrapped) values work too, just like a single option():
Options([null, undefined, "hello"]);          // Ok("hello") - raw truthy wins
Options(["", 0, "zero is skipped, 0 used"]);  // Ok("...") - skips "" first
Options([null, undefined, ""]);               // Err("No value!") - all raw falsy
```

Useful when values come from different functions with inconsistent return types and all you care about is whether the end result is usable.

### SafeTry

Wraps potentially throwing functions in try-catch, returning a `Result<T, string>`. Always needs to be awaited as its async.

```ts
import { safeTry } from "slang-ts";

const result = await safeTry(() => {
  if (denom === 0) throw new Error("Cannot divide by zero");
  return num / denom;
});

if (result.isOk) {
  println("Result:", result.value);
} else {
  println("Error:", result.error);
}

// Async functions work the same way
const data = await safeTry(async () => {
  const res = await fetch("/api/user");
  return res.json();
});

if (data.isOk) {
  println("User:", data.value);
}

// Re-throw critical errors instead of capturing
await safeTry(() => {
  throw new Error("Critical!");
}, { throw: true });
```

### Pipe

Sequential function composition where each function receives a `Result` and returns a `Result`. Accepts plain values, Option, Result, or Atom as initial input.

```ts
import { pipe, Ok, Err, option, type Result } from "slang-ts";

// Create pipeline functions
const add = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value + x) : res;

const multiply = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value * x) : res;

// Basic usage
const result = await pipe(5, add(3), multiply(2)).run();
println("Result:", result.value); // 16

// With Options as initial value
const fromOption = await pipe(option(10), add(5)).run();
println("From option:", fromOption.value); // 15

// With callbacks and error handling
const result = await pipe(5, add(3), multiply(2)).run({
  onEach: ({ currentFn, prevResult }) => {
    println("Executed:", currentFn);
  },
  onSuccess: (value) => println("Done:", value),
  onError: (err) => println("Failed:", err.message),
  allowErrors: false, // stops pipeline on first Err
});
```

### To

Converts between Slang types.

```ts
const statusAtom = atom("active").to("option");
println("Option:", statusAtom);           // Some("active")

const stateOption = option("ready").to("atom");
println("Atom:", stateOption.description); // "ready"

const errResult = option(null).to("result");
println("Result:", errResult.type);        // "Err"
```

### Atom

Creates unique, non-interned symbols with semantic descriptions. Each call produces a distinct identity. Define them in one file and import from it everywhere else, handy for env-var style constants.

```ts
import { atom } from "slang-ts";

const userAtom = atom("kizz");
const user2Atom = atom("kizz");

println(userAtom === atom("kizz")); // false - non interned
println(userAtom.description);      // "kizz"

if (userAtom === user2Atom) {
  println("all the same");
} else {
  println("not the same");          // This prints!
}
```

### Zip

Combines multiple collections element-wise into tuples.

```ts
import { zip } from "slang-ts";

// Zip arrays
const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const arr3 = [7, 8, 9];
println(zip([arr1, arr2, arr3]));
// [[1,4,7],[2,5,8],[3,6,9]]

// Zip with fillValue
println(zip([arr1, [10, 20]], { fillValue: 0 }));
// [[1,10],[2,20],[3,0]]

// Zip Sets with includeValues=true
const s1 = new Set([10, 20, 30]);
const s2 = new Set([100, 200, 300]);
println(zip([s1, s2], { includeValues: true }));
// [[10,100],[20,200],[30,300]]

// Zip objects with includeValues=true
const o1 = { a: 1, b: 2, c: 3 };
const o2 = { x: 100, y: 200, z: 300 };
println(zip([o1, o2], { includeValues: true }));
// [[1,100],[2,200],[3,300]]
```

### ZipWith

Combines collections and applies transform function to each tuple.

```ts
import { zipWith } from "slang-ts";

const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const arr3 = [7, 8, 9];

println(zipWith([arr1, arr2, arr3], (t) => t.reduce((sum, x) => sum + x, 0)));
// [12, 15, 18]
```

### Unzip

Reverses zip operation, separating tuples back into arrays.

```ts
import { unzip } from "slang-ts";

const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];

const zipped = zip([arr1, arr2]);
println(unzip(zipped));
// [[1, 2, 3], [4, 5, 6]]
```

### Panic

Throws an error immediately. Use for unrecoverable failures.

```ts
import { panic } from "slang-ts";

function processUser(user: User | null) {
  if (!user) panic("User cannot be null");
  return user.name;
}

// Guard clause pattern
const config = loadConfig();
if (!config.apiKey) panic("API key required");
```

### println

console.log sugar that stays out of production. Prints a line (args joined, newline appended) and does nothing once `setEnvironment` puts the app in production mode. Dev chatter never leaks to prod logs. Already have an advanced logger? Hand it to `setEnvironment({ printFn })` and every println routes through it: your logging code stays exactly as it is, in every mode.

```ts
import { println, setEnvironment } from "slang-ts";

setEnvironment("development"); // "dev" works too (default)
println("name:", name);
println("multiple", "args", "work", { too: true });

setEnvironment("production"); // "prod" works too
println("not printed in prod");

// Route println through an existing logger instead, even in prod
import { appLogger } from "./logger";
setEnvironment({ printFn: (line) => appLogger.info(line.trimEnd()) });
```

### Signal

A trigger (we call them signals) is a switch that fires once and stays fired. Flip it when you're ready, and anything waiting on it reacts. They're interchangeable with the platform's `AbortSignal`, so a signal you create can be handed to anything that already accepts one.

```ts
import { createSignal } from "slang-ts";

const ready = createSignal();

ready.addEventListener("abort", () => println("ready!")); // fires when the trigger goes off
ready.fire();                                             // flip it
```

The useful part: gate work on a signal, or publish events when a lifecycle completes.

```ts
const task = superPromise(loadUser, { defer: ready }); // starts only once ready fires

channel.when({
  signal: task.done,   // task finished, success or not
  topic: "user.loaded",
  data: { id: userId },
});
```

### SuperPromise

Native JavaScript promises plus execution controls: wait before starting, retry when it fails, time out when it hangs, cancel from outside, `done` trigger to wire into other things. Tasks settle into `Ok` or `Err`: just check outcome, no try/catch around awaits. Library exports no short alias: alias locally when the name gets heavy: `import { superPromise as sp }`.

```ts
import { superPromise } from "slang-ts";

// A fetch that gives up after 5 seconds and tries up to 3 more times
const result = await superPromise(
  (signal) => fetch("/api/user", { signal }),
  { timeout: 5000, retry: 3 }
);

if (result.isOk) {
  println("User:", result.value);
} else {
  println("Failed:", result.error);
}
```

No `await` handy? Chain with `.then`; the callback receives the same `Result`:

```ts
superPromise(loadUser, { timeout: 5000 }).then((result) => {
  if (result.isOk) {
    println("User:", result.value);
  } else {
    println("Failed:", result.error);
  }
});
```

Need it to wait for something else first? `defer` holds execution until a signal fires; chain operations so the next starts only when the previous is done:

```ts
const config = superPromise(loadConfig);
const user = superPromise(loadUser, { defer: config.done });

const result = await user; // config runs first, then user
```

Cancel from outside, or keep retrying until you call it off:

```ts
task.abort();                                  // cancel; you get Err("Aborted")
superPromise(fetchData, {
  retryUntil: { signal: stopSignal, delay: 2000 }, // keep trying until stopSignal fires
});
```

One gotcha worth knowing: a task doesn't start until you consume it (`await`, `.then()`, or a runner's `start()`), so you can wire up dependencies first and they'll run in the right order when awaited.

Also handy:

```ts
const manual = superPromise<number>();  // no executor; settle it yourself
manual.resolve(100);                    // or manual.reject(error)

await superPromise(loadUser).tap((user) => println(user.name)); // observe without changing
```

### SuperRunner

Same idea as `Promise.all`, `Promise.race`, and plain `await` chain, but for SuperPromises, with cancellation and clean `Result` outcomes. Use it when multiple operations are needed: run several in order, in parallel, or take first to finish. Call `start()` once and read result; calling again just hands back same result without re-running anything.

```ts
import { superRunner, superPromise as sp } from "slang-ts";

// In order: steps that depend on each other; stops at the first failure
const auth = superRunner({
  type: "sequence",
  runners: [sp(authenticate), sp(loadProfile), sp(loadDashboard)],
});
const ordered = await auth.start(); // [authResult, profileResult, dashboardResult]

// In parallel: all kicked off at once; result keyed by name
const parallel = superRunner({
  type: "all",
  runners: {
    user: sp(getUser),
    posts: sp(getPosts),
    settings: sp(getSettings),
  },
});
const combined = await parallel.start(); // { user, posts, settings }

// First to finish: take whichever source responds first, cancel the rest
const first = superRunner({
  type: "race",
  count: 1,
  runners: {
    primary: sp(fetchPrimary),
    backup: sp(fetchBackup),
    cache: sp(fetchCache),
  },
});
const winner = await first.start(); // { cache: ... } or whichever won
```

Cancel everything with one call:

```ts
workflow.abort(); // cancels all active children
```

### Channel

Channel lets parts of your app that don't know each other talk: one side publishes, another listens, no wiring between them.

```ts
import { createChannel } from "slang-ts";

const channel = createChannel();

const unsubscribe = channel.subscribe({ topic: "user.created" }, (event) => {
  println("Created:", event.data);
});

channel.send({ topic: "user.created", data: user });
unsubscribe(); // stop listening
```

Publish when a trigger goes off, a task finishing, anything at all:

```ts
channel.when({
  signal: workflow.done,
  topic: "workflow.completed",
  data: { workflowId },
});
```

## Code Samples

See [example.ts](https://github.com/Hussseinkizz/slang/blob/main/example.ts) for usage of currently implemented methods.

## Contributing

Contributions are welcome. I know there are a lot of cool things out there we can bring in.
