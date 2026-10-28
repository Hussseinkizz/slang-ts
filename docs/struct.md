# struct

`struct(input)` reads, shapes, and merges plain records. It also groups an array of records by a
key. Every operation returns a fallible result you finish with `.else(...)` or `.panic(...)`.

## What it is

`struct` accepts a plain record, an array of records, or a narrowed successful `Ok` holding either.
An `Err` is refused with `INVALID_INPUT`.

The returned `StructChain<T>` is a `Fallible<T>`:

- `else(fallback)`: the value, or a fallback value/function. A function fallback receives the error.
- `panic(message?)`: the value, or a thrown error. The message defaults to the failure message.
- `outcome`: the underlying `Result<T, string>`.
- `code`: the failure code, or `undefined` on success.

Record operations (`get`, `pick`, `omit`, `merge`, `count`, `prune`) need a record. Collection
operations (`countBy`, `keyBy`) need an array. Using one on the wrong shape fails with
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

const port = struct(config).get(["server", "port"], 3000).else(3000);
println(port); // 8080

const timeout = struct(config).get(["server", "timeout"], 5000).else(5000);
println(timeout); // 5000

const server = struct(config).get("server").else({ host: "localhost", port: 3000 });
println(server.port); // 8080
```

`get` takes a string key or an array path. A string is a single key; it is not split on dots.
`get(["server", "port"])` walks two levels. A known top-level key keeps its type, so `get("server")`
returns the type of `config.server`. A nested or unknown path is `unknown`.

Only own properties are read. A missing key, or a path through a value that is not a record, fails
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

`pick` keeps the named keys that exist. `omit` drops the named keys and leaves the rest. Both
return new records; neither mutates the input. Missing `pick` keys are dropped quietly, and unknown
`omit` keys are ignored.

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
concatenated. It never mutates the base or the patch, and it skips `__proto__`, `constructor`, and
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

`countBy` counts rows per key. `keyBy` keeps one row per key; the last row wins. Group keys are
stringified, so the number `1` becomes the key `"1"`. Both need an array; a record fails with
`INVALID_INPUT`.

### Resolve a failure

```ts
const missing = struct(user).get("nickname");
println(missing.code);         // "OUT_OF_BOUNDS"
println(missing.else("none")); // "none"

const name = struct(user).get("name").panic();
println(name); // "Ada"
```

`.else` accepts a value or a function. `.panic` throws with the failure message, or with the message
you pass.

## Notes

- A string path is one key. Use an array for nesting. `get("server.port")` reads a literal
  `"server.port"` key, not two levels.
- A known top-level key keeps its type. A nested, unknown, or array path is `unknown`. A fallback
  on a known top-level key widens the result to the value type or the fallback type.
- `merge` skips `__proto__`, `constructor`, and `prototype` at every level. Nested objects that the
  source does not touch stay shared with the original.
- `count` counts own enumerable top-level keys. It does not recurse, and it does not accept an
  array.
- `countBy` counts rows per stringified key. `keyBy` keeps the last row for a duplicate key. Both
  return plain objects; `__proto__` stays a data key.
- `prune` drops Slang-falsy values by default and keeps `0` and `false`. Its predicate receives the
  value and the key. It needs a record.
- A wrong shape for the operation is `INVALID_INPUT`. A missing `get` path is `OUT_OF_BOUNDS`.
  Chains short-circuit on the first failure, and the code survives.

## See also

- [list](list.md)
- [sets](sets.md)
- [Result](result.md)
- [Option](option.md)
