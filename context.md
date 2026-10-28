# Slang agent documentation context

**Version:** 1.0  
**Date:** October 28, 2026  
**Author:** Codex (orchestrating agent)

## 1. README / docs tone cleanup (completed)

Goal: give `slang-ts` docs a direct, human voice while preserving the user's own wording where requested.

### Preserved verbatim (user's own wording)

- README heading "Why I Made This?" and its paragraph, including "rameda" and "evenning."
- README intro: "A collection of utilities and mechanisms brought over from languages like Rust and Erlang. Each utility is deliberately chosen and built from scratch with zero dependencies." (word "chosen", not "selected".)

### Removed

- Release/version bookkeeping from README and CHANGELOG; `package.json` is the version source.
- Changelog release/unreleased labels and dates: it lists features/changes only.
- README note about versions.
- Obvious platform notes (localStorage browser-only, fetch availability, console.log fallback).
- Internal details users don't need, e.g. the `outcome` property on `Fallible`.

### Moved / restructured

- Requirements belong at the bottom of the README, before License.
- README "What's inside" lists each utility on its own line (bulleted, grouped by area).
- README License line: "MIT License. See [LICENSE][license]." (no "for the full text".)

### Terminology rename (not a published API break; 0.2.0 is unreleased)

- Public failure concept renamed from `.code` / `SlangErrorCode` to `.category` / `SlangErrorCategory` because the string labels are categories, not numeric codes.
- Applied consistently across `src/fallible.ts`, `src/list.ts`, `src/struct.ts`, `src/sets.ts`, `src/iterate.ts`, `src/index.ts`, and four test files (`tests/list.spec.ts`, `tests/struct.spec.ts`, `tests/sets.spec.ts`, `tests/iterate.spec.ts`).
- Unrelated `.code` fields in `tests/describe-thrown.spec.ts` and `tests/raw-and-collect.spec.ts` were NOT renamed.

### Natural wording pass (no jargon users don't need)

Words/phrases removed or replaced across README, `docs/README.md`, `CHANGELOG.md`, `docs/safe-try.md`, `docs/result.md`, `docs/to.md`, `docs/iterate.md`, `docs/super-promise.md`, `docs/super-runner.md`, `docs/task-group.md`, `docs/signal.md`, `docs/stepper.md`, `docs/panic.md`, and source comments:

- "executor" → "your function" / "your callback"
- "boundary" → "edge of your app" / "place where several shapes meet"
- "capability" → dropped
- "terminal" → "finishing method" / "finish the chain"
- "admission" → "slot" / "new slot"
- "evicted" / "retained" → "dropped" / "stored"
- "settles" / "settled" → "ends" / "finishes"
- "orchestrat" → "manages" / "runs"
- "upstream" → "same service"
- "budget" → "limit"
- "idempotent" → "runs once" / "only runs once"
- "one-shot" → "fires once" / "single-use"
- "wrapper chain" → "wrappers you return"
- "surface" → dropped
- "contract" → "receives input it can't handle"
- "activation" / "consumption" → "start" / "use"
- "reacquire" → "waits for"

Specific doc edits:
- `docs/stepper.md`: finished wording review; no leftover "an dropped," "commit," "retained," or "evicted."
- `docs/list.md` / `docs/struct.md` / `docs/sets.md`: removed `outcome` bullets (internal `Result` leak).
- `docs/match.md`: added error-category example using `matchAll` to turn `.category` strings into user-facing messages.
- `docs/list.md`: failure example checks `.category` first, uses `.else([])` for `OUT_OF_BOUNDS`, and `.panic(failed.category)` for unhandled failures: panic with the category itself since a custom user message is never read once the program panics.
- `docs/struct.md` / `docs/list.md`: removed redundant `.get(x, fallback).else(fallback)`: `get` already takes a fallback; use one or the other.

## 2. Repo hygiene (completed)

- Untracked dev-only root Markdown files and added them to `.gitignore`:
  `AGENTS.md`, `context.md`, `intent.md`, `plan.md`, `safe-try-plan.md`, `slang-utilities-decisions.md`, `slang-utilities-spec.md`.
- Files remain on disk; only removed from Git tracking.
- `README.md` and `CHANGELOG.md` remain tracked.
- `docs/superpromises.spec.md` and `docs/internal/` remain tracked (not root dev Markdown).

## 3. Version

- npm latest is `0.1.1`; repo version is `0.2.0` (unpublished).
- 0.2.0 is not published, so the `.code` → `.category` rename is not a published API break.

## 4. Verification

- `bun run export` (test + typecheck + build): 490 tests pass, typecheck clean, build clean (`dist/index.js` + `dist/index.d.ts`).
- No broken relative links in `docs/`.

## 5. New: agent skill folder (this change)

- `skill/SKILL.md`: agent-facing guide to slang-ts APIs, patterns, and conventions.
- `package.json` `files` now includes `skill/SKILL.md` so it ships in the published package.
- README mentions the skill folder for agents working with slang-ts.

## 6. Pending

- Version bump (0.2.0 → 0.2.1).
- Commit and push to `origin/main`.
- User will publish to npm.
