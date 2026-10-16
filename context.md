# Slang build migration context

**Version:** 1.0  
**Date:** October 16, 2026  
**Author:** Codex

## 1. Problem and approved approach

Nile's strict NodeNext consumer exposed a packaging issue in Slang 0.0.8. The previous build bundled JavaScript with Bun, then emitted a separate declaration tree with TypeScript. Its root declaration exported `./src`, and internal declaration imports omitted file extensions. NodeNext rejects these declaration paths.

The user approved migrating Slang's builder and fixing this issue. The chosen approach bundles declarations with tsdown 0.23.1 and TypeScript 7.0.2 through the native `tsgo` generator. Source imports and public APIs remain unchanged. tsdown describes its TypeScript 7 API integration as experimental; the migrated build succeeds without suppressing errors.

## 2. Build and package contract

`bun run build` runs the existing tests, checks types, then runs tsdown. The output remains ESM at `dist/index.js`; types are bundled at `dist/index.d.ts`. `package.json` explicitly exports the type entry before the import and default entries. No CommonJS output is added.

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
