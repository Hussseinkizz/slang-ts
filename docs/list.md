# list

`list(input)` gives you a chain over a finite array, with strict bounds. Out-of-range work fails
instead of clamping, so a bad page or batch is visible instead of quietly returning less data.

## What it is

You can pass a raw array, or a narrowed successful `Ok` that holds one:

```ts
list([1, 2, 3]);     // ListChain<number>
list(Ok([1, 2, 3])); // ListChain<number>
```

Anything else fails with `INVALID_INPUT`, including an `Err` or an `Ok` that doesn't hold an array.

The returned `ListChain<T>` is also a `Fallible<readonly T[]>`. You finish it with one of these:

- `else(fallback)`: returns the value, or the fallback. A function fallback receives the error.
- `panic(message?)`: returns the value, or throws. The message defaults to the failure message.
- `outcome`: the underlying `Result<readonly T[], string>`.
- `code`: the `SlangErrorCode` for a failure, or `undefined` on success.

Most operations return a new chain. `get` and `count` return a `Fallible` value. Your input array is
never mutated.

## When to use it

- You need indexed reads, slicing, or chunking with explicit bounds.
- You want negative indices to count from the end.
- You're preparing pages or batches and want to know when a request is out of range.
- You need to remove empty values without dropping `0` or `false`.

## How to use it

```ts
import { list, Ok, println } from "slang-ts";

const numbers = list([10, 20, 30, 40, 50]);

println(numbers.take(2).else([]));       // [10, 20]
println(numbers.skip(2).else([]));       // [30, 40, 50]
println(numbers.skip(-2).else([]));      // [10, 20, 30]
println(numbers.range(1, 4).else([]));   // [20, 30, 40]
println(numbers.range(-3, -1).else([])); // [30, 40]
println(numbers.get(-1).else(0));        // 50
println(numbers.chunk(2).else([]));      // [[10, 20], [30, 40], [50]]
println(numbers.count().else(0));        // 5

const wrapped = Ok([1, 2, 3]);
println(list(wrapped).take(2).else([])); // [1, 2]
```

- `take(n)` keeps the first `n` items. The count has to be from `0` to the array length.
- `skip(n)` drops the first `n`, or the last `n` when negative. Its absolute value can't exceed the
  length.
- `range(start, end)` returns `start` up to but not including `end`. Both bounds accept negative
  indices.
- `get(index)` reads one index. `-1` is the last item.
- `chunk(size)` splits the array into groups.
- `count()` returns the length.

### Read an index with a fallback

```ts
const users = [{ id: 1 }, { id: 2 }];

const second = list(users).get(1, null).else(null);
println(second?.id); // 2

const missing = list(users).get(9, null).else(null);
println(missing); // null
```

The fallback only covers an integer index that's outside the array. A non-integer index still fails
with `INVALID_INDEX`, and without a fallback a miss fails with `OUT_OF_BOUNDS`.

### Take a page

```ts
const offset = 20;
const size = 10;
const all = list(users);
const total = all.count().else(0);
const start = Math.min(Math.max(offset, 0), total);
const end = Math.min(start + size, total);
const page = all.range(start, end).else([]);
```

`range` doesn't clamp. A bound past the array fails with `OUT_OF_BOUNDS`, and two valid bounds with
`start > end` fail with `INVALID_RANGE`. Clamp both bounds first, like above, so the last page
can be short.

### Chunk a batch

```ts
const batches = list([1, 2, 3, 4, 5]).chunk(2).else([]);

for (const batch of batches) {
  println("Batch size:", batch.length);
}
```

The final batch can be shorter. `chunk` needs a positive integer size, and anything else fails with
`INVALID_CHUNK_SIZE`.

### Clean an array

```ts
const values = [0, false, "", null, undefined, Number.NaN, 5];
const clean = list(values).prune().else([]);
println(clean); // [0, false, 5]
```

By default, `prune` drops Slang-falsy values: `null`, `undefined`, `""`, `NaN`, and the infinities.
It keeps `0` and `false`. Pass a predicate if you'd rather choose yourself; it receives the value
and the original index.

### Failures and codes

```ts
const failed = list([1, 2, 3]).range(1, 99).take(1);
println(failed.code);          // "OUT_OF_BOUNDS"
println(failed.outcome.isErr); // true
println(failed.else([]));      // []

println(list([10, 20, 30]).take(2).panic()); // [10, 20]
// list([10, 20, 30]).take(9).panic("Page is out of range"); // throws
```

`range` fails first, so `take` never runs. The code from the first failure survives the rest of the
chain, and `.code` is `undefined` on success.

Here are the codes:

- `INVALID_INPUT`: you passed something other than an array or a successful `Ok` holding one.
- `INVALID_INDEX`: an index, count, or range bound wasn't an integer.
- `OUT_OF_BOUNDS`: an index, count, or bound landed outside the array.
- `INVALID_RANGE`: two in-bounds range ends had `start > end`.
- `INVALID_CHUNK_SIZE`: the chunk size wasn't a positive integer.

## Notes

- Bounds are strict. `take(5)` on a two-item list fails instead of returning two items. Clamp first
  if you want a partial result.
- `get` needs an integer. `1.5`, `NaN`, and `Infinity` fail with `INVALID_INDEX`, and a fallback
  won't rescue those.
- Negative indices count from the end: `-1` is the last item, `-length` is the first. `skip(-n)`
  drops the last `n` items. `range` normalizes both bounds.
- `range` is half-open. `range(3, 3)` on a three-item list is a valid empty result.
- A `get` fallback makes the chain successful. Even an explicit `undefined` counts as a fallback.
- `prune` keeps order and returns a new chain.
- `count()` after `chunk()` counts chunks, not the original items.

## See also

- [struct](struct.md)
- [sets](sets.md)
- [Result](result.md)
- [Zip](zip.md)
- [Option](option.md)
