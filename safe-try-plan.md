# Recursive safeTry plan

**Version:** 1.0  
**Date:** October 16, 2026  
**Author:** Codex

## 1. Trace the current contract

Contract agreed: recursively unwrap mixed Result/Option/Atom chains, normalize nested failures, preserve ordinary payloads and nested Promises, detect wrapper cycles, and retain the stated throwing behavior. The browser issue check found zero open issues. Implementation tracing and contract review are complete.

## 2. Implement the agreed behavior

**Complete.** Only `src/safe-try.ts` changes behavior and its internal inferred return type. `tests/safetry-recursive.spec.ts` adds 18 passing regression tests; the original 24 safeTry tests and other utilities remain unchanged. Ordinary payloads are not traversed. Pre-change files are preserved under `backup/recursive-safe-try-2026-10-16/`.

## 3. Test the actual package

**Complete.** All 348 tests across 16 files, TypeScript 7 checking, and tsdown pass. The packed artifact passes strict TypeScript 5.9.3 and 7.0.2 consumers under NodeNext and Bundler resolution, with `skipLibCheck: false`, recursive inference, and rejected invalid assignments. Node ESM recursive and identity checks pass. Nile source-only typechecking, isolated strict `.mts`/`.cts` consumers, and Node 24 ESM/CommonJS action/service checks pass; this does not claim a fresh full Nile test-suite run. Previous output is preserved at `trash/recursive-safe-try-2026-10-16/dist/`. Reports are preserved under the backup's `verification/package/` and `verification/nile-integration/` directories.

## 4. Document and review

**Complete.** README and context cover the agreed contract and compatibility impact. All three self-contained examples pass source checks and also compile and execute against the packed artifact across all four compiler/resolution combinations, with exact expected output assertions. Context records modified files, backups, the browser's zero-open-issues result, and reflection. No checks remain pending and no QA failures remain unresolved. Package version stays 0.0.8; nothing is published and Nile's registry dependency remains unchanged.

**Author:** Codex

*This plan reflects the approved task and is updated as implementation and verification complete.*
