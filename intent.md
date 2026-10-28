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

## Utility extensions (2026-10-28)

Implemented `slang-utilities-spec.md` and `slang-utilities-decisions.md`: `list`, `struct`, `sets`,
`Ok.iterate`, `memoized`, `taskGroup`, and `createStepper`. A shared `Fallible<T>` chain carries the
outcome, a stable error code, and mandatory `.else()`/`.panic()` resolution.

Defaults chosen for the open questions:

- `maxHistory` is 50.
- `prev()` before the logical first step throws; it never invents an origin.
- `keyBy` is last-wins; grouping keys are stringified and built with `Object.fromEntries`, so
  `__proto__` is an own property rather than a prototype mutation. `pick`, `omit`, and `prune` use
  the same own-property construction.
- `merge` deep-merges plain objects, replaces arrays and other values, and skips
  `__proto__`/`constructor`/`prototype`.
- Retrying a `SuperPromise` reacquires its task-group admission; `taskGroup` has no debounce yet.
- Stepper `prev()` updates the current position, including when the target is still retained; a
  later `next` then replaces the abandoned forward branch.

`Ok.iterate` is a success-path method only. Marking `IterateChain<out C>` covariant keeps
`Result<T>` assignable across `T` while the chain's type parameter is the collection, so `map`
callbacks receive the element type. A one-shot iterator is consumed once; a second terminal fails
instead of silently replaying it.

### Final review and v0.2.0

The pre-release review closed these gaps:

- Generic `SetsChain<T>`/`SetsElement` typing, including `ReadonlyMap`; `union` widens, the other
  algebra keeps the left element type.
- `StructGet<T>` preserves a known top-level key type and widens only with a fallback;
  `struct.keyBy` returns the inferred row type.
- `ListGet<T>` types fallback widening correctly.
- Stepper `prev()` updates `position`; forward commits discard the abandoned branch only after
  duplicate/`keyEvalFn` validation. `maxSteps` counts lifetime commits.
- Prototype-safe `pick`/`omit`/`prune`/`countBy`/`keyBy`; `merge` validates both records.
- Idempotent task-group release per admission.
- `SlangErrorCode` covers only fallible collection chains; Stepper keeps plain messages/panics.

Edge-case and type tests were added, including `tests/types.spec.ts` and cross-runner task-group
coverage. Final `bun run export`: **490 tests across 26 files**, clean typecheck, `dist/index.js` 23.00 kB and `dist/index.d.ts`
40.57 kB. `package.json` is `0.2.0`, README and the specification baseline say v0.2.0. Not
published. Pre-change files are in `backup/utilities-finish-2026-10-28/`.

## README and documentation restructure (2026-10-28)

The README becomes the landing page: description, install, the existing plain utility list, one
brief `0.0.1 – 0.2.0` release summary, categories, real-world examples, and a documentation map.
The per-utility reference moves to `docs/`, with one page per utility or tightly related family.
Every page follows the same shape: what it is, when to use it, how to use it, and notes.

Existing README prose is preserved where it is still accurate; examples move into the matching doc
rather than being rewritten from scratch. The voice stays conversational and practical. Technical
claims come from the current README, implementation, and verified tests, not new assumptions.
`docs/superpromises.spec.md` and `docs/internal/` stay untouched. The existing utility list remains
plain text.

Impact: documentation only. No source, tests, package metadata, or release behavior changes.
Backup: `backup/readme-docs-2026-10-28/README.md`.

### Tone and spacing pass (2026-10-28)

The README and every `docs/` page were reviewed again for calm, practical prose. The pass fixed the
`Opiniated` typo, replaced the awkward SafeTry boundary paragraph, folded the standalone Code
Samples section into the docs links, shortened the Development section, removed repeated
explanations and notes that restated the examples, and gave subheadings clearer names. Each page
keeps the same shape: a short definition, then What / When / How / Notes. Links and anchors were
rechecked. `docs/superpromises.spec.md` and `docs/internal/` were not touched.

Contrast examples were then added to the reference pages where the plain version carries real
boilerplate: SafeTry, SuperPromise, SuperRunner, taskGroup, createStepper, and memoized. Each
shows the Slang version first and the plain TypeScript version second. Thin wrappers such as
Option, Result, Signal, Atom, Channel, and the collection helpers were left alone; a side-by-side
there would be noise rather than relief.

Backup: `backup/readme-docs-2026-10-28/` (README plus all docs pages) and
`backup/readme-docs-contrast-2026-10-28/` (the five edited reference pages).

## New-user onboarding pass (2026-10-28)

A first-time-user review found the main blocker: npm latest is 0.1.1 while the source and docs
describe 0.2.0. The README now carries a short version note until 0.2.0 is published. Publishing
remains a manual step; no publish was run.

The README is reorganized around the first minute: badges, install, requirements, a runnable quick
start, imports, a problem-first table, a complete linked utility map, the existing real-world
examples, development, contributing, and license. The old 28-item checklist is gone; its content
is folded into the linked map, with methods grouped under Option and Result. Release history moves
to `CHANGELOG.md`.

All README links to repo files use absolute GitHub URLs so they survive npm rendering. Package
metadata adds a Node 20+ engine floor, an optional TypeScript peer, `CHANGELOG.md` in the published
files, and a description that matches the current scope. The bundled entry is marked side-effectful
so the `.to()` converters register reliably after bundling; this replaces the unsafe
`sideEffects: false` flag. `example.ts` is no longer advertised as a consumer example; it gets an
internal-playground header. CI was intentionally not added.

The docs index notes the source version and the example assumptions (`println` optional,
browser-only `localStorage`, `fetch` availability). No docs site yet: the content is navigable at
this size; revisit after 1.0 or when the docs outgrow the index.

Impact: README, docs, package metadata, and the example header only. No library source, tests,
version bump, or publish. Backup: `backup/readme-onboarding-2026-10-28/`.

## Tone pass and release-note cleanup (2026-10-28)

The version note is gone from the README and the docs index. `package.json` is the single source of
the version, so the docs no longer repeat it or warn about npm lag. Requirements moved to the bottom
of the README, just before the license.

`CHANGELOG.md` is now a feature and change list grouped by area. Version headings, dates, and the
"unreleased" label are gone, so the file never needs editing just because a release happened.

The "Why I Made This?" heading and paragraph are untouched. The rest of the README and every docs
reference page speak to the reader as "you", use contractions, and keep the author's practical,
informal tone. Obvious platform notes were removed: the browser-only `localStorage` explanation,
the `fetch` availability note, and the `console.log` fallback. Code blocks, headings, links, type
signatures, and technical claims are unchanged.

Impact: README, `CHANGELOG.md`, and docs prose only. No library source, tests, package metadata, or
publish. Backup: `backup/readme-tone-2026-10-28/`.
