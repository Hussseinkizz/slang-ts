# Panic

`panic(message)` throws immediately. Use it when continuing would be worse than stopping.

## What it is

`panic` is a small guard for unrecoverable states: missing configuration, a broken invariant, a
case the program cannot safely continue from. It does not return.

## When to use it

- A required config value is missing at startup.
- A function's contract was violated and there is no sensible fallback.
- You want a guard clause instead of nesting the rest of the function.

Use [Result](result.md) for expected failures the caller can handle. A panic is for the cases where
there is no useful recovery path.

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

## Notes

- `panic` throws an `Error`. It is still a normal JavaScript throw, so an outer `try`/`catch` can
  catch it. That does not make it a recovery strategy.
- The message reaches the caller. Make it useful and human-readable.
- Do not use `panic` for validation or user input. Return an `Err`, a form error, or a proper
  response instead.
- Guard early. A panic in the middle of a workflow leaves more state behind than one at the door.

## See also

- [Result](result.md)
- [Expect](option.md#expect)
- [println](logging.md)
