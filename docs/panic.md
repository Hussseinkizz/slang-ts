# Panic

`panic(message)`: throws immediately. Use it when carrying on would be worse than stopping.

```ts
// Signature
panic(message: string): never;
```

`panic` is for unrecoverable states: missing configuration, a broken invariant, a case the program
can't safely continue from. It throws an `Error`, so an outer `try`/`catch` can catch it: but that
doesn't make it a recovery strategy. Use `Result` for expected failures the caller can handle.

## What it is

`panic` is a small guard for states you can't recover from: missing configuration, a broken
invariant, a case the program can't safely continue from. It doesn't return.

## When to use it

- A required config value is missing at startup.
- A function receives input it can't handle and there's no sensible fallback.
- You want a guard clause instead of nesting the rest of the function.

Use [Result](result.md) for expected failures the caller can handle. Reach for a panic when there's
no useful recovery path.

## How to use it

```ts
import { panic } from "slang-ts";

type User = { name: string };

function processUser(user: User | null) {
  if (user === null) panic("User cannot be null");
  return user.name;
}

const config = { apiKey: "" };
if (!config.apiKey) panic("API key required");
```

## Technical Notes

- `panic` throws an `Error`, so an outer `try`/`catch` can catch it. That doesn't make it a
  recovery strategy.
- The message reaches the caller, so make it useful and human-readable.
- Don't use `panic` for validation or user input. Return an `Err`, a form error, or a proper
  response instead.
- Guard early. A panic in the middle of a workflow leaves more state behind than one at the door.

## See also

- [Result](result.md)
- [Expect](option.md#expect)
- [println](logging.md)
