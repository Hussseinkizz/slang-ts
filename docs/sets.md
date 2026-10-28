# sets

`sets(input)` turns a collection into a membership chain. It accepts arrays, iterables, `Set`,
`Map` keys, string characters, and plain object keys.

## What it is

Use `sets` when the question is "is this value a member?" or "what do these collections share?".
The chain wraps a native `Set`, so comparison follows native semantics: primitives by value,
objects by identity. Duplicate values collapse to one member.

The returned `SetsChain<T>` is a `Fallible<Set<T>>`:

- `else(fallback)`: the value, or a fallback value/function. A function fallback receives the error.
- `panic(message?)`: the value, or a thrown error. The message defaults to the failure message.
- `outcome`: the underlying `Result<Set<T>, string>`.
- `code`: `INVALID_INPUT` on failure, or `undefined` on success.

Supported input:

- An array or any iterable: each yielded value is a member.
- A `Set`: a copy of its members.
- A `Map`: its keys only.
- A string: its characters.
- A plain object: its own enumerable keys.
- A narrowed successful `Ok` holding any of the above.

An `Err`, a number, `null`, `undefined`, or any other unsupported value fails with
`INVALID_INPUT`. `sets` copies the input while building the chain.

## When to use it

- You have a permissions or feature-flag object and care about its keys, not its values.
- You need to deduplicate a list before counting or storing it.
- You need to compare collections: shared values, additions, removals.
- You have a `Map` and need its keys as a set.

## How to use it

```ts
import { sets, println } from "slang-ts";
```

### Check membership

```ts
const permissions = { read: true, write: false };

println(sets(permissions).has("write").else(false)); // true
println(sets(permissions).has("delete").else(true)); // false

println(sets({ read: true }).has("read").panic()); // true
```

For an object input, `has` asks about keys, not values. `write: false` is still a member because the
key exists. That is usually what you want for permissions and feature flags.

### Deduplicate

```ts
const tags = sets(["api", "web", "api", "cli"]);

println(tags.count().else(0)); // 3
println([...tags.unique().else(new Set())].join(", ")); // "api, web, cli"
```

Building the chain already drops duplicates, so `count` is the number of distinct members. `unique`
returns a fresh copy of that set; it does not change `tags`. A string works the same way, one
character per member:

```ts
println(sets("aba").count().else(0)); // 2
```

### Combine sets

```ts
const frontend = sets(["html", "css", "ts"]);
const backend = ["ts", "sql"];

const all = frontend.union(backend).else(new Set());
println([...all].join(", ")); // "html, css, ts, sql"

const shared = frontend.intersection(backend).else(new Set());
println([...shared].join(", ")); // "ts"

const onlyFrontend = frontend.difference(backend).else(new Set());
println([...onlyFrontend].join(", ")); // "html, css"
```

`union` keeps members from both sides. `intersection` keeps members present in both. `difference`
keeps members from the left side that are not on the right. Each returns a new set; none mutates the
source.

`union` widens the element type because the result can contain values from either side.
`intersection` and `difference` keep the left element type, since both only return left-side
members.

### Read Map keys

```ts
const usersById = new Map([
  ["u1", { name: "Ada" }],
  ["u2", { name: "Grace" }],
]);

println(sets(usersById).has("u1").else(false)); // true

const ids = sets(usersById).unique().else(new Set());
println([...ids].join(", ")); // "u1, u2"
```

A `Map` contributes its keys only. The values are ignored, so a map of records works as a set of
ids.

### Objects and identity

```ts
const member = { id: 1 };

println(sets([member]).has(member).else(false)); // true
println(sets([member]).has({ id: 1 }).else(true)); // false
```

Objects are compared by reference. Two objects with the same fields are different members. Strings,
numbers, booleans, and `NaN` are compared by value; `NaN` matches `NaN`.

## Notes

- `sets` copies the input. A `Set` or `Map` you pass in is not changed, and later changes to it are
  not reflected in the chain.
- `has` returns a boolean outcome. A missing member is a successful `false`, not a failure.
- `union`, `intersection`, and `difference` accept the same input forms as `sets`, including a
  narrowed `Ok`. They return new sets and never mutate the chain or the input.
- Object input uses own enumerable keys; inherited keys are ignored. Values are ignored too, so a
  `false` flag still contributes its key.
- The only code `sets` raises is `INVALID_INPUT`. Finish the chain with `.else(...)` or
  `.panic(...)`.

## See also

- [list](list.md)
- [struct](struct.md)
- [Result](result.md)
- [Option](option.md)
