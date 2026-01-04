import type { Option } from "./option";
import type { Result } from "./result";
import { panic } from "./panic";

/** Unique symbol to brand atoms */
declare const __atom__: unique symbol;

/** Atom type carrying the original name for hover/type info */
export type Atom<T extends string = string> = symbol & {
  readonly [__atom__]: T;
};

/** Methods available on an Atom */
export interface AtomMethods<T extends string> {
  /** Returns the same atom */
  to(target: "atom"): Atom<T>;
  /**
   * Returns `Option<string>` using the atom description.
   * @example atom("ready").to("option") // Some("ready")
   */
  to(target: "option"): Option<string>;
  /**
   * Returns `Ok<string>` using the atom description.
   * @example atom("ready").to("result") // Ok("ready")
   */
  to(target: "result"): Result<string, string>;
  /**
   * Transforms the atom description, returns new Atom.
   * - If fn returns `undefined`, returns original Atom (no new allocation).
   * - If fn returns non-string, panics.
   * - If fn throws, panics.
   * - Sync only (no async support for Atom).
   * @example
   * atom("hello").andThen(s => s.toUpperCase());  // Atom("HELLO")
   * atom("test").andThen(s => undefined);         // Atom("test") - original
   */
  andThen<U extends string>(fn: (value: T) => U | undefined): Atom<U> & AtomMethods<U>;
}

/** Lazy import to avoid circular dependency */
let _toFn: ((value: any, target: string) => any) | null = null;

/**
 * Sets the _to converter function (called from to.ts to break circular dep).
 * @internal
 */
export function setToConverter(fn: (value: any, target: string) => any) {
  _toFn = fn;
}

/**
 * Creates a new, unique atom (non-interned).
 * - Atoms are symbols with additional methods for type-safe conversions.
 * @param name - Name of the atom (used for hover/description).
 * @returns `Atom<T>` with chainable `to()` method for conversions.
 * @example
 * const ready = atom("ready");
 * ready.to("option"); // Some("ready")
 * ready.to("result"); // Ok("ready")
 */
export function atom<const T extends string>(name: T): Atom<T> & AtomMethods<T> {
  const s = Symbol(name);
  const boxed = Object(s) as any;

  const to: AtomMethods<T>["to"] = ((target: "atom" | "option" | "result") => {
    if (!_toFn) throw new Error("Converter not initialized");
    return _toFn(s, target);
  }) as any;

  const andThen = <U extends string>(
    fn: (value: T) => U | undefined,
  ): Atom<U> & AtomMethods<U> => {
    let result: U | undefined;

    try {
      result = fn(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      panic(`Atom.andThen: fn threw an error: ${message}`);
    }

    // undefined means return original
    if (result === undefined) return boxed as unknown as Atom<U> & AtomMethods<U>;

    // Must be string
    if (typeof result !== "string") {
      panic(`Atom.andThen: fn must return a string, got ${typeof result}`);
    }

    return atom(result) as Atom<U> & AtomMethods<U>;
  };

  boxed.to = to;
  boxed.andThen = andThen;
  return boxed as Atom<T> & AtomMethods<T>;
}
