# Atom

`atom(name)` — a unique symbol with a readable description. Two atoms with the same name are not
equal.

```ts
// Signature
atom<T extends string>(name: T): Atom<T> & AtomMethods<T>;

/* Atom — branded symbol */
atom.description;   // the name (readable in logs and type hints)
atom.andThen(fn);   // transforms description, returns new Atom; sync only
atom.to(target);    // "option" | "result" — Some(name) | Ok(name)
```

Atoms earn their place when identity actually matters — state names, event keys, and constants
where an accidental collision would be a bug. `matchAll` matches atoms by description.

## What it is

Atoms look like constants, but they carry identity. Two atoms with the same name aren't equal. That
makes them useful for state names, event keys, and environment-style constants, where an accidental
collision would be a bug.

```ts
const userAtom = atom("kizz");
const user2Atom = atom("kizz");

println(userAtom === user2Atom);    // false
println(userAtom.description);      // "kizz"
```

## When to use it

- You need a stable, unique token for a state or lifecycle value.
- You want a readable name in logs, errors, and type hints without sharing identity.
- You're matching states with `matchAll`, which uses the atom's description.

For plain string constants, a normal `const` is simpler. Atoms earn their place when identity
actually matters.

## How to use it

Define atoms in one module and import them where you need them. Re-create one at each call site
and you lose the identity.

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

`andThen` transforms the description and gives you a new atom.

## Notes

- `andThen` is sync only. Return a non-string or throw, and it panics.
- Return `undefined` from `andThen` and you keep the original atom.
- `matchAll` matches atoms by description, not identity. That's intentional, so don't confuse it
  with equality.
- `atom.to("option")` and `atom.to("result")` use the description.

## See also

- [To](to.md)
- [Match](match.md)
- [Option](option.md)
