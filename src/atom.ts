import type { Option } from "./option";
import type { Result } from "./result";

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

  boxed.to = to;
  return boxed as Atom<T> & AtomMethods<T>;
}
