# Zip

`zip`, `zipWith`, and `unzip` combine aligned collections and take them apart again.

## What it is

`zip` turns parallel collections into rows. `zipWith` does the same and transforms each row.
`unzip` reverses `zip`, turning rows back into columns.

This is the shape of CSV rows, report columns, and any data that arrives as "these arrays line up".

## When to use it

- You have parallel arrays and want to iterate them together.
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

Set `includeValues: true` to read values from `Set`s or objects. Without it, only arrays are
accepted.

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

## Notes

- By default, only arrays are accepted. `includeValues: true` adds `Set`s and objects.
- Keep inputs the same kind. `zip` does not check that they match, so mixing arrays and objects
  works only if their index order means something to you.
- Without `fillValue`, `zip` stops at the shortest input. With `fillValue`, it extends to the
  longest input and fills the gaps.
- For objects, `includeValues: true` reads values, not keys. Key order follows `Object.values`.
- `unzip` returns one array per tuple position. An empty input returns `[]`.
- `zip` and `zipWith` return new arrays; they do not mutate the inputs.

## See also

- [list](list.md)
- [Ok.iterate](iterate.md)
