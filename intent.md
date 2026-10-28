# Intent: slang-ts Result and safeTry improvements

Status: implemented and verified locally on 2026-10-27. Not published.

## Result

- `src/internals.ts` gains `describeThrown` and its private helpers (`readMessageField`,
  `clampMessage`, `stringifyGuarded`).
- Used at six sites: `src/safe-try.ts`, `src/result.ts` (both `Ok.andThen` catches), `src/pipe.ts`,
  `src/super-promise.ts` (`normalizeError`), `src/atom.ts`, and `src/internals.ts` (`evaluateValue`).
- Two test assertions moved from `"[object Object]"` to the object's JSON text:
  `tests/safetry.spec.ts` and `tests/superpromise.spec.ts`.
- New `tests/describe-thrown.spec.ts` adds 12 tests.
- `bun run test`: 364 passed across 17 files. `bun run typecheck`: clean.
- Pre-change files are in `backup/describe-thrown-2026-10-27/`.

## Part 2: non-enumerable raw on a Result

`Err(error, raw?)` now takes an optional cause, mirroring `Ok(value, message?)`. The cause is
attached to the returned Result as a non-enumerable `raw` property, exactly as given and never
normalized. It never appears in `JSON.stringify`, spread or `Object.keys`, so the safe message
stays the only thing on the wire. `Err`'s type gains `readonly raw?: unknown`. A new internal
`attachRaw` in `src/result.ts` does the define-before-freeze work; it is not re-exported by
`src/index.ts`.

`safeTry` passes a caught throw to `Err(message, error)`, so a normal call carries the thrown value
itself on `.raw`. A nested failure propagates the inner `Err`'s own `.raw`, so the cause reaches the
outer result on that path too. In every failure, `result.error` is the message and `result.raw` is
the raw object.

A plain `Ok` has no `.raw`. On the Ok path the raw payload is `.value`; a separate property would
only duplicate it and would collide with the collect container in Part 3.

Impact: additive. No existing signature changes (the second `Err` parameter is optional), and no
test that reads `.error` is affected.

## Part 3: safeTry `collectValues`

`safeTry(fn, { collectValues: true })` records every unwrapped layer and every failure on the
returned Result's `raw`, shaped `{ errors, values }`. The terminal `value` is unchanged, so the
return type does not move and default callers are untouched. Entries are raw: each `values` entry is
the layer value as unwrapped, and each `errors` entry is the raw failure (the `Err`'s own error, or
the thrown value), never the humanized message.

Impact: additive behind the flag. Default `false` keeps today's behaviour and leaves `raw`
undefined.

## Part 4: no nested Results

`Ok(value)` refuses a Result. The guard is a shared `NestedResultGuard<T>` type used as a trailing
rest parameter: it collapses to a required element only when `T` is a Result, so an existing call
keeps its inference and `Ok(Ok(x))` or `Ok(Err(x))` is a compile error. An intersection form was
tried first; it narrowed literal inference and broke `.unwrap().else(0)` in the suite, so it was
replaced. `Err`'s error is a string, so it cannot nest.

`Result.andThen` is the exception, because it is a pipeline step we control: a Result it returns is
flattened and passed through, never wrapped again, so `Ok(5).andThen(x => Ok(x * 2))` gives `Ok(10)`.
The rule applies where the input is explicit, not to a pipeline the library drives.

`buildOk` (internal, not re-exported) builds an `Ok` without the compile-time guard, and refuses a
Result at runtime by throwing. So every explicit-input builder (`Ok`, `Options`, `SuperPromise`
`resolve`) refuses nesting, while `andThen` flattens it.

`safeTry`'s fn may return a Result, but not one whose value is another Result: a `NestedValueGuard`
rest parameter rejects that at the type level. At runtime it panics (throws) on a Result inside a
Result, because an untyped value (from `any`, JSON or plain JS) can still carry one. Option and Atom
layers still unwrap, so `result.value` is the last unwrapped value and the intermediates go in the
`collectValues` collection.

The invariant across the library: no utility returns a `Result<Result>`. Every builder that would
hold a Result unwraps it; `andThen` and `pipe` pass a returned Result through and panic if that
Result's own value is a Result; `buildOk` panics on a Result; `safeTry` panics on a nested one. The
panic is one message, "A Result cannot be nested inside another Result".

Consequence: `safeTry` no longer unwraps a nested Result through the public constructors; it panics on
it. The recursive tests now build nested values through an untyped escape and assert the panic,
and cover Option and Atom unwrapping, long Option chains and circular Options instead.

## Verification for parts 2 and 3

- New `tests/raw-and-collect.spec.ts` adds 11 tests: `raw` on `Err`, `raw` on a caught throw, the
  collected `{ errors, values }` shape for a nested success, a nested failure, a caught throw and a
  mixed Result/Option chain, the non-enumerable property, and `raw` staying undefined when the flag
  is off.
- `bun run test`: 383 passed across 18 files. `bun run typecheck`: clean.

Note: `tests/superpromise.spec.ts` was also touched (its assertion and title); its pre-change form
is in git `HEAD`, not the backup directory.

## What

Add one internal helper, `describeThrown(value)`, that turns any thrown value into a usable
message, and use it everywhere the library currently writes
`error instanceof Error ? error.message : String(error)`.

`describeThrown` resolves, in order:

1. `Error` returns its `.message` (the current path, unchanged).
2. A string returns itself.
3. A bigint returns its decimal text.
4. A non-null object returns its `message`, then `error`, then `reason` field when that field is a
   non-empty string.
5. A guarded `JSON.stringify` (bigint and cycles handled, functions and symbols dropped).
6. `Object.prototype.toString.call(value)`.

The result is bounded to 512 characters.

## Why

A thrown value is not always an `Error`. Fetch wrappers and some database drivers throw plain
objects, and `String({ code: "X" })` is `"[object Object]"`, which tells a reader nothing. Every
project downstream writes its own repair helper for this. One shared normalizer fixes it once.

## Where

- New: `src/internals.ts` gains `describeThrown` and a private `stringifyGuarded`.
- Replaced call sites:
  - `src/safe-try.ts` catch block.
  - `src/result.ts` `Ok.andThen` (async `.catch` and the sync `catch`).
  - `src/pipe.ts` `executePipeFn` catch.
  - `src/super-promise.ts` `normalizeError`.
  - `src/atom.ts` `andThen` catch.
- `src/internals.ts` `evaluateValue` also uses it, so a non-string `Result` error stops rendering as
  `"[object Object]"`.

## Behaviour change and the one test it moves

Only a non-Error throw changes text, and only for the better. One existing test pins the old text:

`tests/safetry.spec.ts`, in "asynchronous functions", asserts `throw { custom: "object" }` becomes
`Err("[object Object]")`. With the normalizer it becomes `Err('{"custom":"object"}')`. That one
assertion is updated.

The `Error` path is byte-for-byte unchanged, so every existing `Error` message and every other test
stays exactly as it is.

## Impact

- No public export, type or signature changes. `safeTry` still returns `Err(string)` by default.
- No change to `{ throw: true }`, to recursive unwrapping, or to any other utility.
- Version bump and publication stay separate from this change, as is the convention here.

## Checks

- `bun run test` (the full suite) green, including the updated assertion.
- `bun run typecheck` green.
- New tests cover: an `Error` keeps its message, a string is unchanged, an object with
  `message`/`error`/`reason` returns that field, a bigint and a cyclic object do not throw, and a
  long payload is truncated.
