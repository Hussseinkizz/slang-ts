# Ok.iterate

`Ok(value).iterate()` — lazy pipelines over a successful collection inside an `Ok`.

```ts
// Signature
Ok<T>(value).iterate(): IterateChain<T>;

/* Transformations — each returns a new chain */
chain.map(callback);        // IterateChain<U> — transform each element
chain.filter(callback);     // IterateChain<T> — keep matching elements
chain.flatMap(callback);    // IterateChain<U> — each value becomes zero, one, or many
chain.take(n);              // IterateChain<T> — at most n values
chain.drop(n);              // IterateChain<T> — skip n values
chain.chunk(size);          // IterateChain<readonly T[]> — groups of size

/* Finishers — return Fallible */
chain.reduce(callback, seed);   // Fallible<accumulator>
chain.count();                  // Fallible<number> — number of values
chain.toArray();                // Fallible<readonly T[]>

/* Finish */
chain.unwrap().else(fallback);    // value or fallback on failure
chain.panic(message?);            // throws on failure (message defaults to the error)
chain.category;                   // SlangErrorCategory | undefined — the failure category
```

`iterate()` only works on a successful `Ok`. An `Err` has no chain — check `.isOk` first.
Transformations are lazy; nothing is read until you call a finisher. `take` can stop an infinite
source early after the count you asked for.

## What it is

`iterate()` only works on a successful `Ok`. An `Err` has no chain. If you hold a `Result` that may
have failed, check `.isOk` first and call `iterate()` inside that branch.

The chain is lazy. Each transformation wraps the source in a new generator, and nothing is read
until you call a finishing method. So an array isn't copied at every step, and `take` can stop an
infinite source after the count you asked for.

The type parameter describes the collection, not the element. `Ok(users)` gives
`IterateChain<User[]>`, and the callbacks in `map`, `filter`, and `flatMap` receive a `User`. `map`
and `flatMap` produce new element types, while `filter`, `take`, and `drop` keep the current one.

## When to use it

- You have a collection inside an `Ok` and want to filter, transform, or batch it.
- You want to stop reading a large or infinite source after a fixed number of values.
- You want a failure from a transform callback to come back as a value instead of a throw.
- You're processing a stream and don't want an intermediate array at every stage.

For strict indexed access with explicit bounds, use [list](list.md). For plain arrays that can't
fail, native array methods are enough. `iterate` earns its place when the collection comes from a
`Result`, or when the work can fail.

## How to use it

```ts
import { Ok, type Result, println } from "slang-ts";

type User = { name: string; active: boolean };

const users: User[] = [
  { name: "Ada", active: true },
  { name: "Grace", active: false },
  { name: "Linus", active: true },
];

const result: Result<User[], string> = Ok(users);

if (result.isOk) {
  const names = result
    .iterate()
    .filter((user) => user.active)
    .map((user) => user.name)
    .toArray()
    .else([]);

  println(names.join(", ")); // Ada, Linus
}
```

`toArray()` returns a `readonly` array. Use `.else(...)` for a fallback, or `.panic(...)` when a
failed chain is a bug you want to catch.

### Flatten and batch

`flatMap` expects an iterable from each callback, so each value can become zero, one, or many
values. `drop` skips values, and `chunk` groups them.

```ts
const posts = [
  { title: "Hello", tags: ["intro", "news"] },
  { title: "Later", tags: ["news"] },
];

const tags = Ok(posts)
  .iterate()
  .flatMap((post) => post.tags)
  .toArray()
  .else([]);

println(tags.join(", ")); // intro, news, news

const batches = Ok([1, 2, 3, 4, 5]).iterate().chunk(2).toArray().else([]);
println(JSON.stringify(batches)); // [[1,2],[3,4],[5]]

const afterFirstTwo = Ok([1, 2, 3, 4]).iterate().drop(2).toArray().else([]);
println(JSON.stringify(afterFirstTwo)); // [3,4]
```

### Reduce and count

`reduce` takes an accumulator callback and a seed. The callback also receives the index. `count`
finishes the chain and returns the number of values.

```ts
const orders = [{ total: 12 }, { total: 8 }, { total: 5 }];

const total = Ok(orders)
  .iterate()
  .reduce((sum, order) => sum + order.total, 0)
  .else(0);

println(total); // 25
println(Ok(orders).iterate().count().else(0)); // 3
```

`reduce` on an empty collection returns the seed.

### Stop early with take

`take(n)` reads at most `n` values. Once it has read `n`, it stops the source early and calls the
source iterator's `return`, so an infinite generator is safe as long as your finishing method only
needs a prefix.

```ts
function* ids() {
  let id = 1;
  while (true) yield id++;
}

const firstThree = Ok(ids()).iterate().take(3).toArray().else([]);
println(JSON.stringify(firstThree)); // [1,2,3]
```

`take` doesn't read one extra value to discover the end. `take(5)` on a two-value source returns
both values, and `take(0)` reads nothing.

### Failures and single-use sources

The methods that finish the chain return `Fallible`, not a plain `Result`. Read `.category` to
branch on the failure, then finish the chain with `.else(...)` or `.panic(...)`.

```ts
const nonIterable = Ok(42).iterate().toArray();
println(nonIterable.category); // INVALID_INPUT
println(JSON.stringify(nonIterable.else([]))); // []

const badTake = Ok([1, 2]).iterate().take(-1).toArray();
println(badTake.category); // INVALID_INDEX
println(badTake.else([]).length); // 0

// nonIterable.panic(); // throws "Cannot iterate a non-iterable value"
```

A single-use iterator can only be consumed once:

```ts
function* values() {
  yield 1;
  yield 2;
}

const chain = Ok(values()).iterate();
println(JSON.stringify(chain.toArray().else([]))); // [1,2]
println(chain.toArray().category); // INVALID_INPUT
```

An array or another re-iterable source can run the finishing method more than once.

## Notes

- `map`, `filter`, and `flatMap` pass `(value, index)`. Indexes start at 0 and count the values
  arriving at that step, and `reduce` passes `(accumulator, value, index)`.
- Transformations are lazy; the source isn't read until you finish the chain. Invalid `take`, `drop`,
  and `chunk` arguments are checked when you call them, and the chain carries the failure.
- `take` and `drop` need a nonnegative safe integer. A negative, fractional, or unsafe count gives
  `INVALID_INDEX`. `chunk` needs a positive safe integer, and anything else gives
  `INVALID_CHUNK_SIZE`. These fail the chain instead of throwing.
- A callback throw becomes an `INVALID_INPUT` failure. A thrown `Error` keeps its message.
- A non-iterable `Ok` value fails when you finish the chain with `INVALID_INPUT` and
  `"Cannot iterate a non-iterable value"`.
- A chain over a single-use iterator shares its consumed flag with every derived chain. A second
  finishing call returns `INVALID_INPUT` with `"This iterator has already been consumed"`.
- Strings are iterable, so `Ok("abc")` gives you characters. `Ok(new Set(...))`, maps, and typed
  arrays are iterable too, and they iterate in their native order.
- The methods that finish the chain return `Fallible`. Resolve with `.else(fallback)`,
  `.else((error) => fallback)`, or `.panic(message?)`. `.panic()` throws the chain's error when you
  don't pass a message.

## See also

- [Result](result.md)
- [SafeTry](safe-try.md)
- [list](list.md)
- [Zip](zip.md)
