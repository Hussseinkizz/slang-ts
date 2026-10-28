# slang-ts documentation

The [README](../README.md) is the tour. These pages are the reference.

These pages describe the current source (`0.2.0`). npm may lag until the next release.

Each page covers a utility or a closely related family: what it is, when to reach for it, how to use
it, and the details worth knowing before you rely on it.

## Start here

- [Result](result.md) and [SafeTry](safe-try.md): turn failures into values instead of scattered
  `try`/`catch`.
- [SuperPromise](super-promise.md): async work with timeouts, retries, cancellation, and `Result`
  outcomes.
- [list](list.md), [struct](struct.md), and [Ok.iterate](iterate.md): strict collections and lazy
  data pipelines.

## Error handling and flow

- [Option](option.md): optional values where `0` and `false` still count.
- [Result](result.md): `Ok`/`Err` outcomes, messages, unwrapping, and `andThen`.
- [SafeTry](safe-try.md): one boundary that captures throws and unwraps Slang wrappers.
- [Match](match.md): exhaustive `Option`/`Result` matching and literal matching with `matchAll`.
- [Options](match.md#options): normalize mixed raw values, `Option`s, and `Result`s.
- [Pipe](pipe.md): sequential steps over a `Result`, stopping at the first failure.

## Composition and conversion

- [Atom](atom.md): unique named symbols for constants and state names.
- [To](to.md): convert between `Option`, `Atom`, and `Result`.
- [Zip](zip.md): combine aligned collections, transform tuples, or unzip them again.

## Collections and data

- [list](list.md): strict indexed arrays with explicit bounds.
- [struct](struct.md): safe record access, shaping, merging, and grouping.
- [sets](sets.md): membership and set algebra with native `Set` semantics.
- [Ok.iterate](iterate.md): lazy `map`/`filter`/`flatMap`/`take` pipelines on a successful
  `Result`.
- [memoized](memoized.md): argument-based function caching.

## Async and lifecycle

- [SuperPromise](super-promise.md): a promise with retries, timeouts, deferral, and cancellation.
- [SuperRunner](super-runner.md): sequence, parallel, and race orchestration for `SuperPromise`s.
- [taskGroup](task-group.md): shared concurrency and start spacing across tasks.
- [Signal](signal.md): a trigger that fires once and stays fired.
- [Channel](channel.md): publish/subscribe between parts of an app that do not know each other.

## Small utilities

- [Panic](panic.md): fail immediately when recovery makes no sense.
- [println](logging.md): development logging that stays out of production.
- [createStepper](stepper.md): bounded, navigable keyed step history.

## A note on examples

Examples use `println` for output. It is optional; `console.log` works. The SafeTry example uses
`localStorage`, which is browser-only; use your platform's storage in Node. Examples that call
`fetch` assume a runtime that provides it (modern browsers and Node.js 20+).

## For contributors

- [SuperPromise specification](superpromises.spec.md)
- [Internal notes](internal/)
