# Slang build migration context

**Version:** 1.0  
**Date:** October 16, 2026  
**Author:** Codex

## 1. Problem and approved approach

Nile's strict NodeNext consumer exposed a packaging issue in Slang 0.0.8. The previous build bundled JavaScript with Bun, then emitted a separate declaration tree with TypeScript. Its root declaration exported `./src`, and internal declaration imports omitted file extensions. NodeNext rejects these declaration paths.

The user approved migrating Slang's builder and fixing this issue. The chosen approach bundles declarations with tsdown 0.23.1 and TypeScript 7.0.2 through the native `tsgo` generator. Source imports and public APIs remain unchanged. tsdown describes its TypeScript 7 API integration as experimental; the migrated build succeeds without suppressing errors.

## 2. Build and package contract

`bun run export` runs the existing tests, checks types, then runs `bun run build` (tsdown). `prepublishOnly` runs `export`, so `npm publish` always builds fresh. The output remains ESM at `dist/index.js`; types are bundled at `dist/index.d.ts`. `package.json` explicitly exports the type entry before the import and default entries. No CommonJS output is added.

The package declares TypeScript `^5.9.3 || ^7.0.2` consumer support. Strict consumer checks against the actual package artifact pass with TypeScript 5.9.3 and 7.0.2 under both NodeNext and Bundler resolution, with `skipLibCheck: false`. Negative type assertions also pass.

The installed builder's Node.js requirement is `^22.18.0 || ^24.11.0 || >=26.0.0`. This requirement applies to building Slang and does not establish a new minimum runtime version for package consumers.

## 3. Verification status

- Before migration: 330 tests across 15 files passed; the existing type check passed.
- Installed migration targets: tsdown 0.23.1 and TypeScript 7.0.2.
- After migration: all 330 tests across 15 files passed, TypeScript 7 type checking passed, and tsdown produced only `dist/index.js` (10.86 kB) and `dist/index.d.ts` (26.85 kB).
- A local 0.0.8 package artifact is packed; it is not published.
- The packed artifact passes all four strict consumer combinations: TypeScript 5.9.3 and 7.0.2, each with NodeNext and Bundler resolution, with `skipLibCheck: false`. Invalid assignments are rejected as expected.
- Node ESM runtime checks pass for safeTry/Result, Option/Atom converters, Pipe, Signal, and Channel. All 22 runtime export names match the previous package.
- Verification reports are preserved at `backup/tsdown-migration-2026-10-16/verification/report.json` and `backup/tsdown-migration-2026-10-16/verification/runtime-exports.json`.
- Nile integration passes against the local packed Slang artifact and copied Nile declarations: TypeScript 7 strict NodeNext checks with `skipLibCheck: false` for both `.mts` and `.cts` consumers, plus Node 24 ESM and CommonJS runtime checks for Nile actions/services with Slang `Ok` and `safeTry`. Evidence is preserved in `backup/tsdown-migration-2026-10-16/verification/nile-integration/`.

## 4. Preserved files and release scope

Original files and the approved intent are preserved in `backup/tsdown-migration-2026-10-16/`. Obsolete build files are preserved in `trash/tsdown-migration-2026-10-16/`; the previous build output is preserved there as well. Trash and backup directories are excluded from project type checking.

This migration does not publish a package or change the release version. Nile's installed npm Slang 0.0.8 remains unchanged; integration verification uses the local tarball. Registry consumers still need a new Slang release to receive this fix. See [plan.md](plan.md) for the implementation scope.

Changed existing files: `package.json`, `bun.lock`, `tsconfig.json`, `README.md`, and generated `dist/index.js` and `dist/index.d.ts`. New files: `tsdown.config.ts`, `plan.md`, and `context.md`. The obsolete `bun-build.ts`, `tsconfig.build.json`, and previous `dist/` are preserved in trash. Original existing files were backed up before changes; earlier documentation drafts are preserved under the backup's `docs-before-final/` directory.

## 5. What this verification taught us

Source tests and the previous type check passed despite invalid published declaration paths. Checking the packaged output with strict consumers exposed the gap. Bundling declarations fixes the package boundary without rewriting source imports. Future build changes should retain these package-level checks.

## 6. Recursive safeTry contract

The user requested recursive unwrapping, clear behavior documentation, and a browser check for existing Slang issues. The logged-in GitHub issues page at https://github.com/Hussseinkizz/slang-ts/issues showed zero open issues during this task.

The approved change applies to `safeTry` only. It repeatedly follows mixed Result and Option wrappers; `Ok` and `Some` expose the next value, while Atom resolves to its description. A nested `Err` becomes the outer `Err` with its error converted through `String`; `None` becomes `Err("Option was None")`. Public return types must resolve to the same terminal success value.

Ordinary object properties and array elements are not traversed. The callback return is awaited once through normal JavaScript awaiting; Promises encountered inside wrappers remain Promise values. `{ throw: true }` rethrows caught callback or wrapper-evaluation errors, but does not throw returned `Err` values. Circular wrapper chains return `Err("Cannot resolve a circular value")` even with `{ throw: true }`.

Compatibility impact: callers that previously inspected a nested success wrapper receive the terminal value instead. Other utilities retain their existing behavior. README examples cover nested successes and failures, mixed wrappers, plain payloads, nested Promises, and throwing behavior. The implementation, local build, strict packaged consumers, executable documentation examples, and downstream Nile integration all pass.

Pre-change files and generated output are preserved in `backup/recursive-safe-try-2026-10-16/`; see [safe-try-plan.md](safe-try-plan.md) for the current task. The earlier build-migration record above remains historical evidence rather than verification of this new change.

## 7. Recursive safeTry verification and preservation

The rebuilt package passes all 348 tests across 16 files, TypeScript 7 checking, and tsdown. The new recursive suite adds 18 passing tests; all 24 original safeTry tests remain unchanged. No export names or other utility implementations change; the recursive return-type helper stays internal.

All three new self-contained README examples pass strict TypeScript 7 checking with `skipLibCheck: false` and execute with their documented outputs against the actual source barrel. They cover nested results and mixed wrappers, payload and Promise identity, returned failures, and thrown callback errors. The same three examples also compile and execute against the packed artifact with exact expected outputs across TypeScript 5.9.3 and 7.0.2, each under NodeNext and Bundler resolution. The package passes all four strict consumer combinations with `skipLibCheck: false`, including recursive inference and negative assignment checks. Node ESM checks verify recursion and unchanged payload identity. Package evidence is preserved in `backup/recursive-safe-try-2026-10-16/verification/package/`, including `report.json` and `readme-report.json`.

Nile integration passes in three distinct checks: its real source entry and transitive imports typecheck against the new Slang declarations using Nile's inherited Bundler resolution and `skipLibCheck: true`, with test fixtures excluded; isolated `.mts` and `.cts` consumers of copied Nile output and the fresh packed Slang artifact pass strict NodeNext checking with `skipLibCheck: false`; and Node 24 ESM and CommonJS action/service checks pass with nested `Ok` values. These are source and package integration checks, not a new run of Nile's full test suite. Evidence is preserved in `backup/recursive-safe-try-2026-10-16/verification/nile-integration/`.

All planned verification is complete with no unresolved QA failures. Version remains 0.0.8 and the package is unpublished. Ordinary Nile installations still use the unchanged registry Slang package until a new release is published and adopted.

Changed existing files for this follow-up: `src/safe-try.ts`, `README.md`, `context.md`, and generated `dist/index.js` and `dist/index.d.ts`. New files: `tests/safetry-recursive.spec.ts` and `safe-try-plan.md`. The original `src/index.ts` and `tests/safetry.spec.ts` remain unchanged. Pre-change files are backed up in `backup/recursive-safe-try-2026-10-16/`; intermediate documentation drafts are preserved there too. Previous build output is preserved in `trash/recursive-safe-try-2026-10-16/dist/`.

The main lesson is that runtime flattening and inferred types must describe the same boundary. Focused tests prove recursive behavior without turning plain payloads into data to traverse. Documentation examples also need direct checks against real constructors: review caught a numeric `Err` example, while this library's constructor accepts only strings. The corrected example is now checked and executable. Future changes should retain both source behavior tests and packaged consumer checks.

## 8. Local 0.0.9 release preparation

The user approved a local version bump and will publish the package separately. `package.json` now declares 0.0.9, and README includes its release notes. Earlier 0.0.8 statements above describe the historical migration and verification artifacts; they do not describe the current local manifest version.

The completed 348-test suite, type checking, build, strict package consumers, README examples, and Nile integration remain applicable. This step changes only release metadata and documentation; source, tests, lockfile, configuration, and generated output stay unchanged. A fresh local archive is checked for version 0.0.9, export entries, and both built files. No package is published.

Changed files for this step: `package.json`, `README.md`, and `context.md`. All three pre-change files and the intent are preserved in `backup/version-bump-0.0.9-2026-10-16/`. Keeping release preparation separate from publication lets the maintainer review and publish the verified package directly.

**Author:** Codex

*This context reflects the current migration and is updated as verification completes.*

## 9. Non-Error throw normalization (describeThrown)

`safeTry`, `superPromise`, `pipe` and `atom.andThen` each converted a thrown value with
`e instanceof Error ? e.message : String(e)`, so a thrown plain object (fetch wrappers and some
drivers do this) became `"[object Object]"`, which tells a reader nothing. Every downstream project
wrote its own repair helper for this.

A single internal `describeThrown` in `src/internals.ts` now resolves the common shapes (an Error's
message, a string, a bigint, an object's `message`/`error`/`reason` field) and falls back to a
guarded, length-bounded `JSON.stringify` that handles cycles. `evaluateValue` uses it too, so a
non-string `Result` error no longer renders as `"[object Object]"`.

Behaviour change: only a non-Error throw changes text, and only for the better. The two assertions
that pinned `"[object Object]"` moved to the JSON text. The Error and string branches are unchanged,
so every existing message and every other test stays exactly as it was.

Changed files: `src/internals.ts`, `src/safe-try.ts`, `src/result.ts`, `src/pipe.ts`,
`src/super-promise.ts`, `src/atom.ts`, `tests/safetry.spec.ts`, `tests/superpromise.spec.ts`. New
files: `tests/describe-thrown.spec.ts` and `intent.md`. Pre-change copies are in
`backup/describe-thrown-2026-10-27/`. Verification: 364 tests across 17 files pass, typecheck clean.
Version and publication are untouched.

## 10. Result raw payloads and safeTry collection

`Err(error, raw?)` takes an optional cause, mirroring `Ok(value, message?)`. The cause rides on the
returned Result as a non-enumerable `raw` property, kept exactly as given and never normalized: it
stays out of `JSON.stringify`, spread and `Object.keys`, so it can carry a driver error or an HTTP
body beside a safe message without reaching the wire. `Err`'s type gained `readonly raw?: unknown`.
The property is defined on the final returned object, not the frozen base, because a non-enumerable
property does not survive the `{ ...base }` spread and a frozen object rejects a later
`defineProperty`. An internal `attachRaw` in `src/result.ts` does it and is not re-exported by
`src/index.ts`.

`safeTry` passes a caught throw to `Err(message, error)`, so a normal call carries the thrown value
itself on `.raw`, and a nested failure propagates the inner `Err`'s own `.raw`. In every failure,
`error` is the message and `raw` is the raw object. With `{ collectValues: true }`, the returned
Result instead carries `raw = { errors, values }`, every unwrapped layer and every failure in order,
each raw and never a humanized message; the terminal `value` is unchanged, so the return type does
not move. A plain `Ok` carries no `raw`, because on that path the raw payload is `.value`. The flag
defaults to `false` and leaves `raw` undefined.

Verification: `tests/raw-and-collect.spec.ts` adds 12 tests; the suite is 376 tests across 18 files
with a clean typecheck. Version and publication untouched.

## 11. No nested Results

A Result never nests inside another Result where the input is explicit. `Ok` rejects a Result value
with a shared `NestedResultGuard<T>` trailing rest parameter, which leaves inference untouched. An
intersection form (`value: T & NoNestedResult<T>`) was tried first and narrowed literal inference,
breaking `.unwrap().else(0)` in the suite, so it was replaced. `Err`'s error is a string, so it
cannot nest.

`Result.andThen` is deliberately exempt: it is a pipeline step we control, so a returned Result is
flattened and passed through, never wrapped again (`Ok(5).andThen(x => Ok(x * 2))` gives `Ok(10)`).
Its fn type is `(value: T) => U | Result<U, string> | Promise<U | Result<U, string>>`.

`buildOk` (internal, not re-exported) builds an `Ok` without the compile-time guard and refuses a
Result at runtime by throwing, so the explicit-input builders (`Ok`, `Options`, `SuperPromise`
`resolve`) cannot nest one.

`safeTry`'s fn may return a Result, but not one whose value is another Result: a `NestedValueGuard`
rest parameter rejects that at the type level. At runtime it panics (throws) on a second Result,
because an untyped value from `any`, JSON or plain JS can still carry one. It returns the last
unwrapped value for allowed chains, and `collectValues` records the intermediates.

The invariant across the library: no utility returns a `Result<Result>`. `andThen` and `pipe` pass a
returned Result through and panic if its own value is a Result; `buildOk` panics on a Result, which
covers `Ok`, `Options`, `SuperPromise` and `to`; `safeTry` panics on a nested one. The panic is one
message, "A Result cannot be nested inside another Result".

Verification: 383 tests across 18 files, typecheck clean. Version and publication untouched.

## 12. Collection utilities and Stepper

The utility specification and its decision record are implemented: `list`, `struct`, `sets`,
`Ok.iterate`, `memoized`, `taskGroup`, and `createStepper`. A shared `Fallible<T>` in
`src/fallible.ts` carries the `Result`, a stable `SlangErrorCode`, and the mandatory
`.else()`/`.panic()` terminals. `list`, `struct`, and `sets` accept a raw value or a narrowed
successful `Ok`; `isResult` is used for the runtime check so a plain object with an `isOk` field is
not mistaken for a Result.

`Ok.iterate` is deliberately not on `ResultMethods` or `Err`: it is a success-path capability.
The first implementation put a conditional element type in the chain's public signature, which
made `Result<T>` and `SuperPromise<T>` invariant in nested callback positions and broke existing
pipe/runner assignments. The fix was to make the chain's type parameter the *collection* and mark
it `out C` (`IterateChain<out C>`), extracting elements with an internal `ElementOf<C>` helper.
That keeps `Result<string>` assignable to `Result<unknown>` while still giving `map` callbacks the
element type.

`take` reads exactly `n` values and closes the source iterator; it does not consume one extra value
to discover the end. A one-shot iterator is detected at construction and a second terminal returns
an `INVALID_INPUT` failure rather than replaying an exhausted source.

`struct` counts and indexes collections with `Object.fromEntries`, which makes `__proto__` an own
property. `pick`, `omit`, and `prune` also build their result through `Object.fromEntries`, so a
prototype-looking key stays a data property instead of changing the result's prototype. `get` and
`pick` read own properties only. `countBy`/`keyBy` infer the row type from the collection passed to
`struct`. `list.get` and `struct.get` use a rest-tuple fallback so an explicit `undefined` fallback is
a successful value rather than "no fallback".

`createStepper` stores retained steps by logical index in a `Map`, so evicted positions are holes
rather than shifted array indices. Forward generations are serialized through a promise queue.
Backward navigation to a retained step updates the current position; reconstruction can restore an
older hole without evicting the reconstructed step to satisfy `maxHistory`, and `prev` before the
logical origin throws. A later `next` commits at the new position and drops the abandoned forward
branch only after duplicate and `keyEvalFn` validation pass. Duplicate retained keys and a rejected
`keyEvalFn` panic even with `{ fallback: true }`.

`taskGroup` grants admission in a loop (no recursion on a large queue), spaces starts when
`throttle > 0`, and recovers when a running task releases. `superPromise` acquires before each
attempt and releases in `finish`, so a retry reacquires and a running task is never cancelled by
the throttle.

Verification: 452 tests across 25 files pass, `bun run typecheck` is clean, and `bun run build`
produces `dist/index.js` (22.90 kB) and `dist/index.d.ts` (39.08 kB). README documents the new
utilities; both specification documents now say implemented. Pre-change files are preserved in
`backup/utilities-finish-2026-10-28/`.

## 13. v0.2.0 review and release preparation

The pre-release review fixed the gaps that the first implementation left:

- `SetsChain` is generic (`SetsChain<T>`), `SetsElement` extracts the contributed element type, and
  the overloads cover arrays, iterables, `Set`, `Map`, `ReadonlyMap`, object keys, and narrowed
  `Ok`s. `union` widens the element type; `intersection`/`difference` keep the left type.
- `StructGet<T>` types a known top-level key as `T[K]`, while an unknown path stays `unknown`; a
  fallback widens to `T[K] | U`. `struct.keyBy` now returns the inferred row type instead of
  `unknown`, via `StructRow<T>`.
- `ListGet<T>` has a typed fallback overload, so `get(9, "none")` is `T | string` rather than an
  unsound `T`.
- Stepper backward navigation to a retained step updates `position`; a later `next` commits at that
  position and discards the abandoned branch only after duplicate-key and `keyEvalFn` validation.
  `maxSteps` counts lifetime commits, not retained history.
- `pick`, `omit`, `prune`, `countBy`, and `keyBy` build with `Object.fromEntries`, so
  `__proto__` stays a data key. `merge` validates both sides as plain records and skips
  `__proto__`/`constructor`/`prototype`.
- Task-group release is idempotent per admission, so a double release cannot free another task's
  slot.
- `SlangErrorCode` is now limited to the fallible collection chains. Stepper deliberately exposes a
  plain `Result` message and panics on invalid keys/boundaries; it has no code surface.

Missing edge-case and type tests were added across the suites, including `tests/types.spec.ts` for
adapter inference, `Result`/`SuperPromise` wide assignments, and the success-only `iterate` surface.
Final verification: `bun run export` passes with **490 tests across 26 files**, a clean typecheck, and
`dist/index.js` (23.00 kB, 7.57 kB gzip) / `dist/index.d.ts` (40.57 kB, 12.18 kB gzip).

`package.json` now declares `0.2.0`. README carries the v0.2.0 release notes, and the utility
specification baseline is v0.2.0. No package is published; release remains a separate maintainer
action.
