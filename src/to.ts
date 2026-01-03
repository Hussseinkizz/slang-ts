import { atom, setToConverter as setAtomConverter } from "./atom";
import type { Atom } from "./atom";
import { option, setToConverter as setOptionConverter } from "./option";
import type { Option, Some } from "./option";
import { Ok, Err } from "./result";
import type { Result } from "./result";

/** Type guard for Option */
const isOption = (v: any): v is Option<any> =>
  v != null && typeof v === "object" && "isSome" in v && "isNone" in v;

/**
 * Converts between Slang types.
 * - `option`: Wraps primitive or symbol description into `Option`
 * - `atom`: Converts `Some<string>` to `Atom` or returns symbol Atom
 * - `result`: Wraps values into `Ok`, `None` into `Err`
 */
export function _to<T>(value: Option<T>, target: "option"): Option<T>;
export function _to<T extends string>(
  value: Option<T>,
  target: "atom",
): Atom<T>;
export function _to<T extends string>(
  value: Atom<T>,
  target: "option",
): Option<string>;
export function _to<T extends string>(value: Atom<T>, target: "atom"): Atom<T>;
export function _to<T, E = string>(
  value: Option<T>,
  target: "result",
): Result<T, E>;
export function _to<E = string>(
  value: Atom<any>,
  target: "result",
): Result<string, E>;

export function _to(value: any, target: "option" | "atom" | "result"): any {
  if (value && (value.type === "Ok" || value.type === "Err")) {
    throw new Error("Cannot convert a Result to any other type");
  }

  switch (target) {
    case "option": {
      if (isOption(value)) return value;
      if (typeof value === "symbol") return option(value.description);
      return option(value);
    }

    case "atom": {
      if (isOption(value)) {
        if (value.isNone) throw new Error("Cannot convert None to Atom");
        if (typeof (value as Some<any>).value !== "string") {
          throw new Error("Only string values can be converted to Atom");
        }
        return atom((value as Some<string>).value);
      }
      if (typeof value === "symbol") return value;
      throw new Error(`Cannot convert type ${typeof value} to Atom`);
    }

    case "result": {
      if (isOption(value)) {
        return value.isSome ? Ok(value.value) : Err("Value is None");
      }
      if (typeof value === "symbol") return Ok(value.description);
      return Ok(value);
    }

    default:
      throw new Error(`Invalid target: ${target}`);
  }
}

// Register the converter with option and atom modules
setOptionConverter(_to as (value: any, target: string) => any);
setAtomConverter(_to as (value: any, target: string) => any);
