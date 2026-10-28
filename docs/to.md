# To

`To` converts between Slang types: `Option`, `Atom`, and `Result`.

## What it is

You'll find the converters as methods on the wrappers themselves, so the type you already have
tells you what you can turn it into.

```ts
option("ready").to("atom");    // Atom("ready")
option(null).to("result");     // Err("Value is None")
atom("ready").to("option");    // Some("ready")
atom("ready").to("result");    // Ok("ready")
```

## When to use it

- A function wants an `Atom`, but you have a string `Option`.
- A caller wants a `Result`, and all you have is an optional value.
- You're crossing a boundary between modules that use different Slang wrappers.

Don't use conversions to hide a failure. `None` becomes `Err("Value is None")`; it doesn't invent a
value.

## How to use it

```ts
import { atom, option, println } from "slang-ts";

const status = atom("active").to("option");
println("Option:", status); // Some("active")

const state = option("ready").to("atom");
println("Atom:", state.description); // "ready"

const failed = option(null).to("result");
println("Result:", failed.type); // "Err"
```

## Notes

- `Option` to `Atom` needs a `Some<string>`. `None` or a non-string `Some` throws.
- `Option` to `Result`: `Some` becomes `Ok(value)`, and `None` becomes `Err("Value is None")`.
- `Atom` to `Option` or `Result` uses the atom's description.
- `Option` to `Option` and `Atom` to `Atom` give you back the same wrapper.
- `Result` is a target, not a source. You can't convert a `Result` into an `Option` or `Atom`.

## See also

- [Option](option.md)
- [Atom](atom.md)
- [Result](result.md)
- [Match](match.md)
