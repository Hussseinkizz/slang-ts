# Atom

`atom("name")` creates a unique symbol with a readable description.

## What it is

Atoms look like constants but carry identity. Two atoms with the same name are not equal. That makes
them useful for state names, event keys, and environment-style constants where accidental collision
would be a bug.

```ts
const userAtom = atom("kizz");
const user2Atom = atom("kizz");

println(userAtom === user2Atom);    // false
println(userAtom.description);      // "kizz"
```

## When to use it

- You need a stable, unique token for a state or lifecycle value.
- You want a readable name in logs, errors, and type hints without sharing identity.
- You are matching states with `matchAll`, which uses the atom's description.

For plain string constants, a normal `const` is simpler. Atoms earn their place when identity
matters.

## How to use it

Define atoms in one module and import them where they are used. Re-creating one at each call site
defeats the identity.

```ts
import { atom, println } from "slang-ts";

const ready = atom("ready");

if (ready === atom("ready")) {
  println("same");
} else {
  println("different"); // This prints.
}
```

Atoms also have `andThen` and `to`:

```ts
atom("hello").andThen((s) => s.toUpperCase()); // Atom("HELLO")
atom("ready").to("option");                    // Some("ready")
atom("ready").to("result");                    // Ok("ready")
```

`andThen` transforms the description and returns a new atom.

## Notes

- `andThen` is sync only. Returning a non-string or throwing panics.
- Returning `undefined` from `andThen` keeps the original atom.
- `matchAll` matches atoms by their description, not by identity. That is intentional, but do not
  confuse it with equality.
- `atom.to("option")` and `atom.to("result")` use the description.

## See also

- [To](to.md)
- [Match](match.md)
- [Option](option.md)
