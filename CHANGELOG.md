# Changelog

All notable changes to `slang-ts`.

## 0.2.0 — unreleased

- Added `list`: strict indexed collections with `get`, `take`, `skip`, `range`, `chunk`, `count`,
  and `prune`.
- Added `struct`: safe record access, `pick`/`omit`/`merge` shaping, and `countBy`/`keyBy`
  grouping.
- Added `sets`: membership and set algebra for arrays, iterables, Maps (keys), and object keys.
- Added `Ok.iterate`: lazy `map`, `filter`, `flatMap`, `take`, `drop`, `chunk`, `reduce`, `count`,
  and `toArray` on a successful `Result`.
- Added `memoized`: argument-based caching with identity semantics for objects and rejected-Promise
  eviction.
- Added `taskGroup`: shared concurrency and start spacing for `SuperPromise`s, with retries
  reacquiring admission.
- Added `createStepper`: bounded keyed step history with backward recovery and explicit `prev`
  resolution.
- Typed adapters: `list`, `struct`, and `sets` keep their element, row, and key types; `get`
  fallbacks widen the result type correctly.
- Mark the bundled entry as side-effectful so the `.to()` converters register reliably after
  bundling.
- Documentation: a shorter README tour, per-utility reference pages, and plain-TypeScript contrasts
  for the utilities that replace real boilerplate.

## 0.1.1 — 2026-10-24

- `Ok(value, message?)` keeps an optional success message on the result, such as text to show the
  user. Results without one have no `message` property.
- `npm publish` now runs `bun run export` first (tests, type check, then build), so the package
  always ships a fresh build.

## 0.1.0 — 2026-10-24

- Published without `Ok` success messages. Use 0.1.1 or later.

## 0.0.9 — 2026-10-16

- `SafeTry`: unwraps Option and Atom values into one result. A Result never nests inside another
  Result, and plain object properties and array elements stay unchanged.
- Bundled declarations work with strict NodeNext consumers, so importing the package no longer
  exposes invalid declaration paths.
- tsdown and TypeScript 7 build JavaScript and bundled types together.

## 0.0.8 — 2026-08-09

- `Signal`: a one-shot trigger that fires once and stays fired.
- `println` respects the environment: `setEnvironment("production")` turns it into a no-op, and
  `{ printFn }` routes output through an existing logger.
- `SuperPromise`: promises with wait, retry, timeout, cancel, and `Ok`/`Err` settlement.
- `SuperRunner`: sequence, parallel, and race orchestration for `SuperPromise`s.
- `Channel`: an in-process publish/subscribe bus.

## Earlier

- 0.0.1–0.0.7: initial Option, Result, Match, and related utilities.
