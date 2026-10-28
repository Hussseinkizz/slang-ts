# createStepper

`createStepper<T>(config?)` keeps a bounded history of keyed steps and lets you move forward and
back. Use it for wizards, onboarding flows, undo stacks, or any state that needs named checkpoints.

## What it is

A stepper stores steps, not arbitrary values. Each step is `{ key, value }`, where `key` is a
nonempty string and `value` is whatever `T` you chose. Keys identify steps and prevent duplicates
in the retained history.

`next(fn, options?)` is asynchronous. It calls `fn(previous, make)`, validates the returned step,
and commits it on success. `fn` may return a step or a Promise of one. `make` is an identity helper
that gives TypeScript the step type, so `make({ key, value })` is all you normally need.

`prev(offset = -1)` is synchronous. It returns a small resolution object that must be finished with
`.else(recover)` or `.panic(message?)`. If the target step is still retained, the resolution
settles immediately. If it was evicted, `.else` asks you to rebuild it from its nearest retained
neighbors, while `.panic` throws instead.

Only `next` returns a `Result`. Finishing `prev` returns a step or throws.

## When to use it

- A wizard or onboarding flow needs back and forward navigation.
- An editor needs a bounded undo history.
- Steps must have unique, meaningful names.
- You want an external check on which step keys are allowed.

For simple value state with no history, a plain variable is enough. For history that must survive a
reload, persist it yourself; the stepper keeps memory only.

## How to use it

A basic history is a stack and a cursor:

```ts
type Screen = { screen: string };
type Step = { key: string; value: Screen };

const history: Step[] = [];
let cursor = -1;

function commit(step: Step) {
  history.splice(cursor + 1); // drop the forward branch
  history.push(step);
  cursor = history.length - 1;
}

function back() {
  if (cursor <= 0) throw new Error("No previous step");
  cursor -= 1;
  return history[cursor];
}
```

That is the easy part. Duplicate keys, a bounded history, and rebuilding an evicted step are the
parts that grow around it. `createStepper` keeps those rules together:

```ts
import { createStepper, println } from "slang-ts";

type Screen = { screen: string };

const wizard = createStepper<Screen>();

await wizard.next((_previous, make) =>
  make({ key: "welcome", value: { screen: "welcome" } }),
);
println(wizard.current?.key); // welcome

await wizard.next((_previous, make) =>
  make({ key: "profile", value: { screen: "profile" } }),
);
println(wizard.current?.key); // profile
println(wizard.prev().panic().key); // welcome
println(wizard.size); // 2
```

`previous` is `undefined` on the first call and the current step after that. `next` is always
async, even when `fn` is synchronous, so await it.

### Branching

A successful forward commit drops any steps ahead of the current position. If you move back and
commit a different step, the old forward branch is gone.

```ts
await wizard.next((_previous, make) =>
  make({ key: "settings", value: { screen: "settings" } }),
);
// The profile step was ahead of welcome, so it is gone now.
```

A key that was evicted can be used again. A key still in retained history cannot.

### Undo with evicted history

When `maxHistory` is small, older steps are evicted. `prev` can still reach one if you supply a
recovery function. It receives the nearest retained step before the target and the nearest one
after it, either of which may be `undefined`.

```ts
const history = createStepper<{ text: string }>({ maxHistory: 2 });

await history.next((_previous, make) =>
  make({ key: "first", value: { text: "Helo" } }),
);
await history.next((_previous, make) =>
  make({ key: "fixed", value: { text: "Hello" } }),
);
await history.next((_previous, make) =>
  make({ key: "shout", value: { text: "Hello!" } }),
);

const restored = history.prev(-2).else((previous, make, next) =>
  make({
    key: "first",
    value: { text: previous?.value.text ?? next?.value.text ?? "" },
  }),
);

println(restored.key);         // first
println(history.current?.key); // first
println(history.size);         // 2
```

The recovered step needs a nonempty string key and a `value` property, and its key must not
duplicate a retained one. Recovery does not run `keyEvalFn` again. Rebuilding the value is your
job; the neighbors only tell you where you are. `.panic()` never reconstructs.

### Limit total steps

`maxSteps` counts successful forward commits over the stepper's lifetime. It is not the size of the
retained history.

```ts
const limited = createStepper<{ page: number }>({ maxSteps: 2 });

await limited.next((_previous, make) => make({ key: "one", value: { page: 1 } }));
await limited.next((_previous, make) => make({ key: "two", value: { page: 2 } }));

const third = await limited.next((_previous, make) =>
  make({ key: "three", value: { page: 3 } }),
);

if (third.isErr) println(third.error); // Step limit reached
```

The failed call does not commit, and `{ fallback: true }` does not bypass the limit.

### Check keys

`keyEvalFn` adds an acceptance check on the candidate key. It can be synchronous or async. Return
`false` to reject it.

```ts
const checkout = createStepper<{ screen: string }>({
  keyEvalFn: async (key) => key.startsWith("checkout:"),
});

const accepted = await checkout.next((_previous, make) =>
  make({ key: "checkout:address", value: { screen: "address" } }),
);
println(accepted.isOk); // true

try {
  await checkout.next((_previous, make) =>
    make({ key: "cart", value: { screen: "cart" } }),
  );
} catch (error) {
  if (error instanceof Error) println(error.message); // Step key rejected: cart
}
```

Returning `false` throws `Step key rejected: <key>`. A thrown error from `keyEvalFn` becomes an
`Err(message)` instead, or the fallback when requested. That difference matters.

## Notes

- `maxHistory` defaults to 50 and must be a positive integer. Steps are evicted to keep the
  retained history at or below it.
- `maxSteps` defaults to `null` (unlimited) and must be a nonnegative integer or `null`. It counts
  successful forward commits over the stepper's lifetime, not the retained size.
- Invalid configuration throws when the stepper is created, not when `next` runs.
- At the step limit, `next` returns `Err("Step limit reached")` without calling `fn`. The current
  step is unchanged.
- `next` is async and calls are serialized, so concurrent calls run one at a time in call order.
  `prev` is synchronous and never returns a `Result`.
- A thrown `fn`, a thrown `keyEvalFn`, or an invalid candidate returns `Err(message)`. With
  `{ fallback: true }` and a current step, the current step is returned as `Ok` instead, and
  nothing is committed.
- An invalid candidate is anything without a nonempty string `key` and a `value` property. The
  default message is `"A step needs a nonempty string key and a value"`.
- A duplicate key that is still retained throws `Duplicate step key: <key>` (the promise rejects),
  even with `{ fallback: true }`.
- A `false` result from `keyEvalFn` throws `Step key rejected: <key>` (the promise rejects). A
  thrown error from `keyEvalFn` is a different path: it returns `Err` and can use the fallback.
- A successful commit removes every step ahead of the current position, then appends the new step.
  A failed validation does not commit.
- `prev(offset)` needs a negative integer offset. `prev()` is one step back; zero, positive, or
  fractional offsets throw.
- Finishing a `prev()` that targets before the first step throws
  `"Cannot step before the first step"`.
- A retained target settles immediately, and the `else` recovery function is not called.
- For an evicted target, `.else(recover)` passes `(previous, make, next)` with the nearest retained
  neighbors. The recovered step must be valid and must not reuse a retained key, or `.else` throws.
- `.panic(message?)` does not reconstruct. It throws your message, or `"History unavailable"` for
  an evicted step, or `"Cannot step before the first step"` before the origin.
- `current` is the step at the current position, or `undefined` before the first commit. `size` is
  the number of retained steps, not the number of commits.
- Reconstructing an evicted step is backward navigation; it does not increase the `maxSteps` count.

## See also

- [Result](result.md)
- [SafeTry](safe-try.md)
