# struct

`struct(input)` — safe record access, shaping, merging, and grouping. Every operation returns a
fallible result you finish with `.else(...)` or `.panic(...)`.

```ts
// Signature
struct<T>(input: T | Ok<T>): StructChain<T>;

/* Record operations — all return Fallible unless noted */
chain.get(path);                          // Fallible<T[path]> — known top-level key keeps its type
chain.get(path, fallback);                // Fallible<T[path] | U> — fallback on missing path
chain.pick(...keys);                      // StructChain<Pick<T, K>> — keeps named keys
chain.omit(...keys);                      // StructChain<Omit<T, K>> — drops named keys
chain.merge(source);                      // StructChain<T> — deep merge, never mutates input
chain.count();                            // Fallible<number> — own enumerable top-level keys
chain.countBy(selector);                  // Fallible<Record<string, number>> — rows per key
chain.keyBy(selector);                    // Fallible<Record<string, row>> — one row per key
chain.prune(predicate?);                  // StructChain<T> — drops Slang-falsy values

/* Finish */
chain.unwrap().else(fallback);    // value or fallback on failure
chain.panic(message?);            // throws on failure (message defaults to the error)
chain.category;                   // SlangErrorCategory | undefined — the failure category
```

`get` already takes a fallback — use either `get(path, fallback)` **or** `get(path).else(...)`, not both.
A string path is one literal key (not split on dots); use an array path for nesting. Missing paths
fail with `OUT_OF_BOUNDS`; wrong shape for the operation fails with `INVALID_INPUT`.

## What it is

You can pass a plain record, an array of records, or a narrowed successful `Ok` holding either. An
`Err` is refused with `INVALID_INPUT`.

The returned `StructChain<T>` is a `Fallible<T>`:

- `else(fallback)`: the value, or a fallback value/function. A function fallback receives the error.
- `panic(message?)`: the value, or a thrown error. The message defaults to the failure message.
- `category`: the failure category, or `undefined` on success.

Record operations (`get`, `pick`, `omit`, `merge`, `count`, `prune`) need a record, and collection
operations (`countBy`, `keyBy`) need an array. Use one on the wrong shape and it fails with
`INVALID_INPUT`.

## When to use it

- You need to read a nested config value without a chain of `&&` checks.
- You want to shape a payload before it leaves your service.
- You have defaults and need to apply a patch.
- You need to group rows by role, status, or id.

## How to use it

```ts
import { struct, Ok, println } from "slang-ts";
```

### Read a nested value

```ts
const config = {
  server: { host: "localhost", port: 8080 },
  debug: false,
};

const port = struct(config).get(["server", "port"], 3000);
println(port); // 8080

const timeout = struct(config).get(["server", "timeout"], 5000);
println(timeout); // 5000

const server = struct(config).get("server").else({ host: "localhost", port: 3000 });
println(server.port); // 8080
```

`get` takes a string key or an array path. A string is a single key, so it isn't split on dots.
`get(["server", "port"])` walks two levels. A known top-level key keeps its type, which means
`get("server")` returns the type of `config.server`. A nested or unknown path is `unknown`.

Only own properties are read. A missing key, or a path through a value that isn't a record, fails
with `OUT_OF_BOUNDS` unless you supply a fallback.

```ts
const maybeUser = Ok({ id: 1, name: "Ada" });
println(struct(maybeUser).get("name").else("unknown")); // "Ada"
```

### Shape a payload

```ts
const user = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
  password: "secret",
  role: "admin",
};

const summary = struct(user).pick("id", "name", "role").panic();
println(summary); // { id: 1, name: "Ada", role: "admin" }

const publicUser = struct(user).omit("password").panic();
println("password" in publicUser); // false
```

`pick` keeps the named keys that exist, and `omit` drops the named keys and leaves the rest. Both
return new records, and neither mutates your input. Missing `pick` keys are dropped quietly, and
unknown `omit` keys are ignored.

### Deep merge a patch

```ts
const defaults = {
  theme: { color: "blue", size: "md" },
  debug: false,
};

const merged = struct(defaults).merge({ theme: { size: "lg" } }).else(defaults);
println(merged.theme.size); // "lg"
println(defaults.theme.size); // "md"

const replaced = struct({ tags: ["api"] }).merge({ tags: ["web"] }).else({ tags: [] });
println(replaced.tags); // ["web"]
```

`merge` walks plain objects and combines their keys. Arrays and other values are replaced, not
concatenated. It never mutates your base or your patch, and it skips `__proto__`, `constructor`, and
`prototype` at every level.

### Group rows

```ts
const rows = [
  { id: 1, role: "admin" },
  { id: 2, role: "user" },
  { id: 3, role: "admin" },
];

const counts = struct(rows).countBy((row) => row.role).else({});
println(counts); // { admin: 2, user: 1 }

const byId = struct(rows).keyBy((row) => row.id).else({});
println(byId[1]); // { id: 1, role: "admin" }

const latest = struct([
  { id: 1, value: "first" },
  { id: 1, value: "last" },
]).keyBy((row) => row.id).else({});
println(latest[1]?.value); // "last"
```

`countBy` counts rows per key. `keyBy` keeps one row per key, and the last row wins. Group keys are
stringified, so the number `1` becomes the key `"1"`. Both need an array, so a record fails with
`INVALID_INPUT`.

### Resolve a failure

```ts
const missing = struct(user).get("nickname");
println(missing.category);     // "OUT_OF_BOUNDS"
println(missing.else("none")); // "none"

const name = struct(user).get("name").panic();
println(name); // "Ada"
```

`.else` takes a value or a function. `.panic` throws with the failure message, or with the message
you pass.

## Notes

- A string path is one key. Use an array for nesting. `get("server.port")` reads a literal
  `"server.port"` key, not two levels.
- A known top-level key keeps its type. A nested, unknown, or array path is `unknown`. A fallback
  on a known top-level key widens the result to the value type or the fallback type.
- `merge` skips `__proto__`, `constructor`, and `prototype` at every level. Nested objects the
  source doesn't touch stay shared with the original.
- `count` counts own enumerable top-level keys. It doesn't recurse, and it won't accept an array.
- `countBy` counts rows per stringified key. `keyBy` keeps the last row for a duplicate key. Both
  return plain objects; `__proto__` stays a data key.
- `prune` drops Slang-falsy values by default and keeps `0` and `false`. Its predicate receives the
  value and the key. It needs a record.
- A wrong shape for the operation is `INVALID_INPUT`, and a missing `get` path is `OUT_OF_BOUNDS`.
  Once a chain fails, later steps don't run, and the category survives.

## See also

- [list](list.md)
- [sets](sets.md)
- [Result](result.md)
- [Option](option.md)
