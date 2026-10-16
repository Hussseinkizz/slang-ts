# Slang build migration plan

User intent: migrate Slang to tsdown and TypeScript 7, fixing declarations consumed by Nile under NodeNext.

1. Preserve the existing ESM entry at dist/index.js and expose bundled declarations at dist/index.d.ts.
2. Replace the separate Bun and TypeScript declaration builds with tsdown 0.23.1 using the TypeScript 7.0.2 native generator.
3. Keep source imports and public APIs unchanged. Add explicit package type exports and retain TypeScript 5.9 consumer support subject to verification.
4. Preserve obsolete build files in trash and exclude preserved copies from type checking.
5. Run the existing suite, build, and isolated TypeScript 5/7 NodeNext and Bundler consumer checks against the packaged output.

Backups and approved intent: backup/tsdown-migration-2026-10-16/. No publishing or server startup is included.

## Results

- Before migration, all 330 tests across 15 files and the existing type check passed.
- Installed targets are tsdown 0.23.1 and TypeScript 7.0.2.
- The builder configuration and package exports now preserve ESM output and bundle declarations. Source imports and public APIs are unchanged.
- Old builder files are preserved in trash; original files and intent are backed up.
- Migrated build passed: 330 tests across 15 files, TypeScript 7 type checking, and bundled JavaScript/declarations. The previous output is preserved in trash.
- A local 0.0.8 package artifact passes strict TypeScript 5.9.3/7.0.2 NodeNext/Bundler consumer checks and Node ESM runtime checks. All 22 runtime export names are preserved.
- Nile integration passes with the local packed Slang artifact: strict TypeScript 7 NodeNext `.mts`/`.cts` consumers and Node 24 ESM/CommonJS action/service runtime checks. Evidence is preserved in `backup/tsdown-migration-2026-10-16/verification/nile-integration/`.
- Nothing is published or version-bumped. Nile's installed npm Slang 0.0.8 is unchanged; registry consumers need a new Slang release. See [context.md](context.md) for the cause, changed files, backups, and maintenance details.
