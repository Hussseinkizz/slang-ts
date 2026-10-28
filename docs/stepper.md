# createStepper

`createStepper<T>(config?)`: bounded history of keyed steps for wizards, onboarding flows, and undo
stacks.

```ts
// Signature
createStepper<T>(config?: { maxHistory?: number; maxSteps?: number | null; keyEvalFn?: (key: string) => boolean | Promise<boolean> }): Stepper<T>;

/* Stepper methods */
stepper.next(fn, options?);     // Promise<Result<Step<T>, string>>: saves a step (async)
stepper.prev(offset?);          // Resolvable: finish with .else(recover) or .panic(message?)
stepper.current;                // Step<T> | undefined: the step at the current position
stepper.size;                   // number: stored step count

/* Config */
{ maxHistory?: number }  : bounded history size (default 50, positive integer)
{ maxSteps?: number }    : lifetime forward moves (default null = unlimited)
{ keyEvalFn? }           : acceptance check on candidate keys
```

Each step is `{ key, value }` where `key` is a nonempty string. `next` is async and calls are
serialized. `prev` is synchronous and never returns a `Result`.

## What it is

A stepper stores steps, not arbitrary values. Each step is `{ key, value }`, where `key` is a
nonempty string and `value` is whatever `T` you picked. Keys identify steps and keep duplicates out
of the stored history.

`next(fn, options?)` is async. It calls `fn(previous, make)`, validates the step you return, and
saves it on success. `fn` can return a step or a Promise of one. `make` is an identity helper that
gives TypeScript the step type, so `make({ key, value })` is usually all you need.

`prev(offset = -1)` is synchronous. It returns a small object that you have to finish with
`.else(recover)` or `.panic(message?)`. If the target step is still stored, it resolves immediately.
If it was dropped, `.else` asks you to rebuild it from its nearest stored neighbors, and `.panic`
throws instead.

Only `next` returns a `Result`. Finishing `prev` gives you a step or throws.

## When to use it

- A wizard or onboarding flow needs back and forward navigation.
- An editor needs a bounded undo history.
- Steps must have unique, meaningful names.
- You want an external check on which step keys are allowed.

For simple value state with no history, a plain variable is enough. For history that has to survive
a reload, persist it yourself; the stepper only keeps memory.

## How to use it

`createStepper` keeps the history rules in one place:

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

Without it, a basic history is a stack and a cursor. That's the easy part; duplicate keys, a
bounded history, and rebuilding a dropped step are the parts that grow around it:

```ts
type Screen = { screen: string };
type Step = { key: string; value: Screen };

const history: Step[] = [];
let cursor = -1;

function saveStep(step: Step) {
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

`previous` is `undefined` on the first call and the current step after that. `next` is always
async, even when `fn` is synchronous, so remember to await it.

### Branching

When you move forward successfully, every step ahead of the current position is dropped. If you
move back and save a different step, the old forward branch is gone.

```ts
await wizard.next((_previous, make) =>
  make({ key: "settings", value: { screen: "settings" } }),
);
// The profile step was ahead of welcome, so it is gone now.
```

A key that was dropped can be used again. A key still in the stored history can't.

### Undo with dropped history

When `maxHistory` is small, older steps get dropped. `prev` can still reach one if you supply a
recovery function. It gets the nearest stored step before the target and the nearest one after
it, either of which may be `undefined`.

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

The recovered step needs a nonempty string key and a `value` property, and its key can't duplicate
a stored one. Recovery doesn't run `keyEvalFn` again. Rebuilding the value is your job; the
neighbors only tell you where you are. `.panic()` never reconstructs.

### Limit total steps

`maxSteps` counts how many times you move forward over the stepper's lifetime. It's not the size of
the stored history.

```ts
const limited = createStepper<{ page: number }>({ maxSteps: 2 });

await limited.next((_previous, make) => make({ key: "one", value: { page: 1 } }));
await limited.next((_previous, make) => make({ key: "two", value: { page: 2 } }));

const third = await limited.next((_previous, make) =>
  make({ key: "three", value: { page: 3 } }),
);

if (third.isErr) println(third.error); // Step limit reached
```

The failed call doesn't save a step, and `{ fallback: true }` doesn't bypass the limit.

### Check keys

`keyEvalFn` adds an acceptance check on the candidate key. It can be sync or async. Return `false`
to reject it.

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
`Err(message)` instead, or the fallback when you asked for one. That difference matters.

## Technical Notes

- `maxHistory` defaults to 50 and must be a positive integer. Steps get dropped to keep the
  stored history at or below it.
- `maxSteps` defaults to `null` (unlimited) and must be a nonnegative integer or `null`. It counts
  successful forward moves over the stepper's lifetime, not the stored size.
- Invalid configuration throws when the stepper is created, not when `next` runs.
- At the step limit, `next` returns `Err("Step limit reached")` without calling `fn`. The current
  step is unchanged.
- `next` is async and calls are serialized, so concurrent calls run one at a time in call order.
  `prev` is synchronous and never returns a `Result`.
- A thrown `fn`, a thrown `keyEvalFn`, or an invalid candidate returns `Err(message)`. With
  `{ fallback: true }` and a current step, the current step is returned as `Ok` instead, and
  nothing is saved.
- An invalid candidate is anything without a nonempty string `key` and a `value` property. The
  default message is `"A step needs a nonempty string key and a value"`.
- A duplicate key that is still stored throws `Duplicate step key: <key>` (the promise rejects),
  even with `{ fallback: true }`.
- A `false` result from `keyEvalFn` throws `Step key rejected: <key>` (the promise rejects). A
  thrown error from `keyEvalFn` is a different path: it returns `Err` and can use the fallback.
- A successful move forward removes every step ahead of the current position, then appends the new
  step. A failed validation doesn't save anything.
- `prev(offset)` needs a negative integer offset. `prev()` is one step back; zero, positive, or
  fractional offsets throw.
- Finishing a `prev()` that targets before the first step throws
  `"Cannot step before the first step"`.
- A stored target resolves immediately, and the `else` recovery function isn't called.
- For a dropped target, `.else(recover)` passes `(previous, make, next)` with the nearest stored
  neighbors. The recovered step must be valid and can't reuse a stored key, or `.else` throws.
- `.panic(message?)` doesn't rebuild anything. It throws your message, or `"History unavailable"`
  for a dropped step, or `"Cannot step before the first step"` before the origin.
- `current` is the step at the current position, or `undefined` before the first step. `size` is
  the number of stored steps, not the number of steps you added.
- Rebuilding a dropped step is backward navigation, so it doesn't increase the `maxSteps` count.

## See also

- [Result](result.md)
- [SafeTry](safe-try.md)
