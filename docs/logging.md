# println

`println` is `console.log` for development output. It stays quiet in production unless you route it
to a logger.

## What it is

Development logging tends to leak. `println` gives you one call site that's silent in production by
default. If you already have a logger, `setEnvironment({ printFn })` sends every `println` there
instead.

## When to use it

- You want quick development output without a full logging dependency.
- You need a small library that stays quiet in production unless the host app wires a logger.
- You want examples and internal messages to follow the app's logging setup.

For structured logs, levels, sampling, or transports, use your app's logger through `printFn`.

## How to use it

```ts
import { println, setEnvironment } from "slang-ts";

setEnvironment("development"); // "dev" works too (default)
println("name:", "Ada");
println("multiple", "args", "work", { too: true });

setEnvironment("production"); // "prod" works too
println("not printed in prod");
```

Or route it through a logger you already have:

```ts
import { appLogger } from "./logger";
import { println, setEnvironment } from "slang-ts";

setEnvironment({ printFn: (line) => appLogger.info(line.trimEnd()) });

println("This goes to appLogger.info, even in production");
```

## Notes

- `println` joins arguments with spaces and appends a newline.
- In production mode it does nothing unless a `printFn` is set.
- A custom `printFn` gets the final line, newline included. Trim it if your logger adds its own.
- `setEnvironment({ printFn })` overrides the mode. `setEnvironment({ printFn: null })` removes the
  custom logger and goes back to the current mode.
- The last call to `setEnvironment` wins, and it's safe to call more than once.
- `println` formats symbols, functions, and plain values. It's not a serializer.
- A throwing `printFn` isn't caught, so keep the logger's own error handling inside it.

## See also

- [Panic](panic.md)
- [Channel](channel.md)
- [SuperPromise](super-promise.md)
