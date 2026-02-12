# slang-ts

Functional programming library for TypeScript.

A collection of functional programming utilities and other cool programming stuff from other languages such as rust implemented in TypeScript.

## Install

```bash
npm i slang-ts
```

## Implemented Utilities

- [x] Result (Ok, Err)
- [x] Maybe (Option)
- [x] andThen
- [x] Atom
- [x] Expect
- [x] Unwrap (on Option)
- [x] Else (on unwrap)
- [x] Panic
- [x] Zip, Unzip, zipWith
- [x] SafeTry
- [x] Match
- [x] MatchAll
- [x] Pipe
- [x] To (converters, e.g. `userAtom.to('option')`)

All utilities fully tested, See [tests](https://github.com/Hussseinkizz/slang/tree/main/tests)

## Others (Planned)

- Pubsub store with state locks
- Promises and async utilities

## How It Works

You can import utilities individually or together:

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

### Atom

Creates unique, non-interned symbols with semantic descriptions. Each call produces a distinct identity. So ideally define them in one file and import from it everywhere else, great for env variables stuff.

```ts
import { atom } from "slang-ts";

const userAtom = atom("kizz");
const user2Atom = atom("kizz");

println(userAtom === atom("kizz")); // false - non interned ✅
println(userAtom.description);      // "kizz"

if (userAtom === user2Atom) {
  println("all the same");
} else {
  println("not the same");          // This prints!
}
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

Well there's nothing special to slang's println utility, its just who wants console.log, its not fun at all, so we instead println, clean and classic, but latter it can be made environment aware so it doesn't print in prod, but for now its just sugar for console.log.

```ts
import { println } from "slang-ts";

const name = "kizz";
println("name:", name);
println("multiple", "args", "work", { too: true });
```

And more are to be implemented in coming versions...

## Code Samples

See [example.ts](https://github.com/Hussseinkizz/slang/blob/main/example.ts) for usage of currently implemented methods.

## Contributing

Contributions are welcome, I know there a lot of cool things out there we can bring in.
