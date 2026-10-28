# Pipe

`pipe` composes functions sequentially. Each function receives a `Result` and returns a `Result`.

## What it is

Use `pipe` when a workflow has several steps and any step can fail. Each function sees the previous
result; by default the pipeline stops at the first failure instead of running the remaining work.

The initial value can be a plain value, `Option`, `Result`, or `Atom`.

## When to use it

- A request has validation, loading, transformation, and saving steps.
- You want a readable order of operations instead of nested `andThen` calls.
- You want one place to log each step and handle the final failure.

If a single transformation is enough, `andThen` is lighter. If the steps are independent and should
run at the same time, use [SuperRunner](super-runner.md) or [taskGroup](task-group.md).

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

## Notes

- Every pipeline function must return a `Result`. Returning anything else becomes
  `Err("Pipeline function must return a Result")`.
- A thrown error is caught and becomes `Err(message)`.
- `allowErrors` defaults to `false`. With `false`, the pipeline returns on the first `Err`.
  With `true`, it continues, and your functions are responsible for handling the failed result.
- `onEach` runs after each function and receives `{ prevResult, currentFn, nextFn }`.
- `onSuccess` runs for a successful final result. `onError` runs for a failed early exit or a
  failed final result.
- A `Result` whose own value is a `Result` panics.
- `run()` returns a promise, so await it.
- The pipeline does not retry, time out, or schedule work. Use [SuperPromise](super-promise.md) for
  that.

## See also

- [Result](result.md)
- [SafeTry](safe-try.md)
- [SuperPromise](super-promise.md)
- [SuperRunner](super-runner.md)
