# Zip

`zip(inputs, options?)`: combines parallel collections into rows; `zipWith` transforms each row;
`unzip` reverses `zip`.

```ts
// Signature
zip<T>(inputs: readonly T[][], options?: { fillValue?: unknown; includeValues?: boolean }): Array<Array<T>>;
zipWith<T, R>(inputs: readonly T[][], fn: (row: Array<T>) => R, options?): Array<R>;
unzip<T>(rows: Array<Array<T>>): Array<Array<T>>;
```

By default only arrays are accepted. `includeValues: true` adds `Set`s and objects (reads values,
not keys). Without `fillValue`, `zip` stops at the shortest input; with it, goes to the longest and
fills gaps. `zip` and `zipWith` return new arrays and don't mutate inputs.

## What it is

`zip` turns parallel collections into rows. `zipWith` does the same thing and transforms each row
along the way. `unzip` reverses `zip`, turning rows back into columns.

That's the shape of CSV rows, report columns, and any data that shows up as "these arrays line up".

## When to use it

- You have parallel arrays and want to walk them together.
- You need to combine named collections into one row per index.
- You have rows and need columns back for storage or display.

## How to use it

```ts
import { zip, zipWith, unzip, println } from "slang-ts";

const arr1 = [1, 2, 3];
const arr2 = [4, 5, 6];
const arr3 = [7, 8, 9];

println(zip([arr1, arr2, arr3]));
// [[1, 4, 7], [2, 5, 8], [3, 6, 9]]
```

### Fill short inputs

```ts
println(zip([arr1, [10, 20]], { fillValue: 0 }));
// [[1, 10], [2, 20], [3, 0]]
```

### Sets and objects

Set `includeValues: true` to read values from `Set`s or objects. Without it, arrays are the only
thing accepted.

```ts
const s1 = new Set([10, 20, 30]);
const s2 = new Set([100, 200, 300]);
println(zip([s1, s2], { includeValues: true }));
// [[10, 100], [20, 200], [30, 300]]

const o1 = { a: 1, b: 2, c: 3 };
const o2 = { x: 100, y: 200, z: 300 };
println(zip([o1, o2], { includeValues: true }));
// [[1, 100], [2, 200], [3, 300]]
```

### Transform rows

```ts
println(zipWith([arr1, arr2, arr3], (row) => row.reduce((sum, x) => sum + x, 0)));
// [12, 15, 18]
```

### Reverse it

```ts
const zipped = zip([arr1, arr2]);
println(unzip(zipped));
// [[1, 2, 3], [4, 5, 6]]
```

## Technical Notes

- By default, only arrays are accepted. `includeValues: true` adds `Set`s and objects.
- Keep the inputs the same kind. `zip` doesn't check that they match, so mixing arrays and objects
  only works if their index order means something to you.
- Without `fillValue`, `zip` stops at the shortest input. With `fillValue`, it goes to the longest
  input and fills the gaps.
- For objects, `includeValues: true` reads values, not keys. Key order follows `Object.values`.
- `unzip` gives you one array per tuple position. An empty input gives you `[]`.
- `zip` and `zipWith` return new arrays and don't mutate the inputs.

## See also

- [list](list.md)
- [Ok.iterate](iterate.md)
