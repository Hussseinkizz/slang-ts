# Pipe

`pipe(value, ...fns)` — runs `Result`-returning steps in order, stopping at the first failure.

```ts
// Signature
pipe<T>(value: T, ...fns: Array<(res: Result<T, string>) => Result<U, string>>): Pipe<T>;

/* Result */
pipe.run(options?);   // Promise<Result<final, string>>
```

Each function receives the previous `Result` and returns a `Result`. By default the pipeline stops
at the first `Err`. Options: `onEach`, `onSuccess`, `onError`, `allowErrors` (default `false` — stop
at the first `Err`). `run()` returns a promise, so await it.

## What it is

Use `pipe` when a workflow has several steps and any of them can fail. Each function sees the
previous result, and by default the pipeline stops at the first failure instead of running the
rest.

You can start with a plain value, `Option`, `Result`, or `Atom`.

## When to use it

- A request needs validation, loading, transformation, and saving steps.
- You want a readable order of operations instead of nested `andThen` calls.
- You want one place to log each step and handle the final failure.

If one transformation is all you need, `andThen` is lighter. If the steps are independent and
should run at the same time, use [SuperRunner](super-runner.md) or [taskGroup](task-group.md).

## How to use it

```ts
import { pipe, Ok, option, type Result, println } from "slang-ts";

const add = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value + x) : res;

const multiply = (x: number) => (res: Result<number, string>) =>
  res.isOk ? Ok(res.value * x) : res;

const result = await pipe(5, add(3), multiply(2)).run();
if (result.isOk) println("Result:", result.value); // 16

const fromOption = await pipe(option(10), add(5)).run();
if (fromOption.isOk) println("From option:", fromOption.value); // 15
```

### Run options

```ts
const result = await pipe(5, add(3), multiply(2)).run({
  onEach: ({ currentFn }) => println("Executed:", currentFn),
  onSuccess: (value) => println("Done:", value),
  onError: (err) => println("Failed:", err.message),
  allowErrors: false, // stop at the first Err
});
```

## Technical Notes

- Every pipeline function has to return a `Result`. Anything else becomes
  `Err("Pipeline function must return a Result")`.
- A thrown error gets caught and becomes `Err(message)`.
- `allowErrors` defaults to `false`. When it's `false`, the pipeline returns on the first `Err`.
  When it's `true`, it keeps going, and your functions have to handle the failed result.
- `onEach` runs after each function and gets `{ prevResult, currentFn, nextFn }`.
- `onSuccess` runs when the final result is successful. `onError` runs on a failed early exit or a
  failed final result.
- A `Result` whose own value is a `Result` panics.
- `run()` returns a promise, so await it.
- The pipeline doesn't retry, time out, or schedule work. Use [SuperPromise](super-promise.md) for
  that.

## See also

- [Result](result.md)
- [SafeTry](safe-try.md)
- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
