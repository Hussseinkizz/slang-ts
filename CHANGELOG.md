# Changelog

Everything notable in `slang-ts`, grouped by area. No release diary — just what's here.

## Results and flow

- `Ok(value, message?)` keeps an optional success message on the result, like text you want to show
  the user. Results without one have no `message` property.
- `SafeTry` unwraps Option and Atom values into one result. A Result never nests inside another
  Result, and plain object properties and array elements stay unchanged.

## Collections and data

- `list`: strict indexed collections with `get`, `take`, `skip`, `range`, `chunk`, `count`, and
  `prune`.
- `struct`: safe record access, `pick`/`omit`/`merge` shaping, and `countBy`/`keyBy` grouping.
- `sets`: membership and set algebra for arrays, iterables, Maps (keys), and object keys.
- `Ok.iterate`: lazy `map`, `filter`, `flatMap`, `take`, `drop`, `chunk`, `reduce`, `count`, and
  `toArray` on a successful `Result`.
- `memoized`: argument-based caching that matches objects by identity, and removal of rejected
  Promises.

## Async and lifecycle

- `SuperPromise`: promises with wait, retry, timeout, cancel, and `Ok`/`Err` settlement.
- `SuperRunner`: run `SuperPromise`s in sequence, in parallel, or as a race.
- `taskGroup`: shared concurrency and start spacing for `SuperPromise`s, with retries waiting for
  a new slot.
- `Signal`: a trigger that fires once and stays fired.
- `Channel`: an in-process publish/subscribe bus.

## Small utilities

- `createStepper`: bounded step history with named steps, undo, and explicit `prev` handling.
- `println` respects the environment: `setEnvironment("production")` turns it into a no-op, and
  `{ printFn }` routes output through an existing logger.

## Typing and packaging

- `list`, `struct`, and `sets` keep their element, row, and key types; `get` fallbacks widen the
  result type correctly.
- Bundled declarations work with strict NodeNext consumers, so importing the package no longer
  exposes invalid declaration paths.
- The bundled entry is marked side-effectful so the `.to()` converters register reliably after
  bundling.
- `npm publish` runs `bun run export` first (tests, type check, then build), so the package always
  ships a fresh build.
- tsdown and TypeScript 7 build the JavaScript and bundled types together.

## Documentation

- A shorter README tour, per-utility reference pages, and plain-TypeScript contrasts for the
  utilities that replace real boilerplate.
