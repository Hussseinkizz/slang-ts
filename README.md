# Slang

Functional programming library for TypeScript.

My experiment to learn more functional programming and other cool programming stuff from other languages as I try to implement them in TypeScript.

## Install

```bash
npm i slang-ts
```

## Implemented Utilities

- [x] Result (Ok, Err)
- [x] Maybe (Option)
- [ ] andThen
- [x] Atom
- [x] Expect
- [x] Unwrap (on Option)
- [x] Else (on unwrap)
- [x] Panic
- [x] Zip, Unzip, zipWith
- [x] SafeTry
- [x] Match
- [x] MatchAll
- [ ] Pipe
- [x] SafeTry
- [ ] Map
- [x] To (converters, e.g. `userAtom.to('option')`)
- [ ] Promises and async utilities
- [ ] Currys

## Others (Planned)

- Pubsub store with state locks

## How It Works

You can import utilities individually or together:

```ts
// Individual imports
import { option } from "slang-ts";
import { Ok, Err } from "slang-ts";

// Or import multiple at once
import { option, Ok, Err, atom, match } from "slang-ts";
```

### println

Well there's nothing special to slang's println utility, its just who wants console.log, its not fun at all, so we instead println, clean and classic, but latter it can be made environment aware so it doesn't print in prod, but for now its just sugar for console.log.

```ts
import { println } from "slang-ts";

const name = "kizz";
println("name:", name);
println("multiple", "args", "work", { too: true });
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

Exhaustive pattern matching for `Option` and `Result` types. Forces you to handle all cases.

```ts
import { match } from "slang-ts";

// Matching Results
const result = divide(10, 0);
match(result, {
  Ok: (v) => println("Success:", v.value),
  Err: (e) => println("Failed:", e.error),
});

// Matching Options
const maybePort = option(process.env.PORT);
match(maybePort, {
  Some: (v) => println("Port:", v.value),
  None: () => println("No port configured"),
});
```

### MatchAll

Pattern matching for primitives and atoms with required `_` fallback.

```ts
import { matchAll } from "slang-ts";

// Match atoms
const ready = atom("ready");
matchAll(ready, {
  ready: () => println("Ready!"),
  failed: () => println("Failed!"),
  _: () => println("Unknown"),
});

// Match booleans
const isActive = true;
matchAll(isActive, {
  true: () => println("Active"),
  false: () => println("Inactive"),
  _: () => println("Unknown"),
});
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

And more are to be implemented in coming versions...

## Code Samples

See [example.ts](https://github.com/Hussseinkizz/slang/blob/main/example.ts) for usage of currently implemented methods.

## Contributing

Contributions are welcome, I know there a lot of cool things out there we can bring in.
