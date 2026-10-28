# slang-ts documentation

The [README](../README.md) is the quick tour. These pages are the reference you come back to.

Each page covers one utility or a close family: what it is, when to use it, and how.

## Start here

- [Result](result.md) and [SafeTry](safe-try.md): turn failures into values instead of scattering
  `try`/`catch` around.
- [SuperPromise](super-promise.md): async work with timeouts, retries, cancellation, and `Ok`/`Err`
  results.
- [list](list.md), [struct](struct.md), and [Ok.iterate](iterate.md): strict collections and lazy
  data pipelines.

## Error handling and flow

- [Option](option.md): optional values where `0` and `false` still count.
- [Result](result.md): `Ok`/`Err`, messages, unwrapping, and `andThen`.
- [SafeTry](safe-try.md): one place that catches throws and unwraps Slang wrappers.
- [Match](match.md): exhaustive `Option`/`Result` matching and literal matching with `matchAll`.
- [Options](match.md#options): normalize mixed raw values, `Option`s, and `Result`s.
- [Pipe](pipe.md): run steps over a `Result` in order and stop at the first failure.

## Composition and conversion

- [Atom](atom.md): unique named symbols for constants and state names.
- [To](to.md): convert between `Option`, `Atom`, and `Result`.
- [Zip](zip.md): combine aligned collections, transform tuples, or unzip them again.

## Collections and data

- [list](list.md): strict indexed arrays with explicit bounds.
- [struct](struct.md): safe record access, shaping, merging, and grouping.
- [sets](sets.md): membership and set operations that follow native `Set` rules.
- [Ok.iterate](iterate.md): lazy `map`/`filter`/`flatMap`/`take` pipelines on a successful
  `Result`.
- [memoized](memoized.md): argument-based function caching.

## Async and lifecycle

- [SuperPromise](super-promise.md): a promise with retries, timeouts, deferral, and cancellation.
- [SuperRunner](super-runner.md): run `SuperPromise`s in sequence, in parallel, or as a race.
- [taskGroup](task-group.md): shared concurrency and start spacing across tasks.
- [Signal](signal.md): a trigger that fires once and stays fired.
- [Channel](channel.md): publish/subscribe between parts of an app that don't know each other.

## Small utilities

- [Panic](panic.md): fail immediately when recovery makes no sense.
- [println](logging.md): development logging that stays out of production.
- [createStepper](stepper.md): bounded, navigable keyed step history.

## For contributors

- [SuperPromise specification](superpromises.spec.md)
- [Internal notes](internal/)
