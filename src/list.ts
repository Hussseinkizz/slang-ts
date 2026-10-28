import { Err, Ok } from "./result";
import type { Result, Ok as OkType } from "./result";
import { isFalsy } from "./option";
import { chain, createFallible, fail, succeed } from "./fallible";
import type { Fallible, SlangErrorCategory } from "./fallible";
import { isResult } from "./internals";

/** Accepted list input: a raw array, or a narrowed successful `Ok` holding one. */
export type ListInput<T> =
  | readonly T[]
  | (OkType<readonly T[]> & { readonly isOk: true });

/** Reads an index, optionally with a fallback of a different type. */
export type ListGet<T> = {
  (index: number): Fallible<T>;
  <U>(index: number, fallback: U): Fallible<T | U>;
};

/** A successful list chain plus its finite indexed operations. */
export type ListChain<T> = Fallible<readonly T[]> & {
  get: ListGet<T>;
  take(n: number): ListChain<T>;
  skip(n: number): ListChain<T>;
  range(start: number, end: number): ListChain<T>;
  chunk(size: number): ListChain<readonly T[]>;
  count(): Fallible<number>;
  prune(predicate?: (value: T, index: number) => boolean): ListChain<T>;
};

const isInteger = (value: number): boolean => Number.isSafeInteger(value);

/** Resolves a negative index against a length. */
const normalizeIndex = (index: number, length: number): number =>
  index < 0 ? length + index : index;

/** Reads either a raw array or a narrowed successful Ok. */
function readList<T>(
  input: ListInput<T>,
): { ok: true; value: readonly T[] } | { ok: false; message: string } {
  if (Array.isArray(input)) return { ok: true, value: input as readonly T[] };

  if (isResult(input)) {
    if (input.isOk === true && Array.isArray(input.value)) {
      return { ok: true, value: input.value as readonly T[] };
    }
    return { ok: false, message: "list expects a raw array or a successful Ok holding one" };
  }
  return { ok: false, message: "list expects an array or a successful Ok" };
}

/** Builds a list chain around an outcome. @internal */
function createList<T>(
  outcome: Result<readonly T[], string>,
  category: SlangErrorCategory | undefined,
): ListChain<T> {
  const base = createFallible(outcome, category);
  const asList = (next: Fallible<readonly T[]>): ListChain<T> =>
    createList<T>(next.outcome, next.category);

  const get = ((index: number, ...fallback: [unknown?]): Fallible<unknown> => {
    return chain(base, (value): Fallible<unknown> => {
      if (!isInteger(index)) return fail<T>("INVALID_INDEX", "Index must be an integer");
      const at = normalizeIndex(index, value.length);
      if (at < 0 || at >= value.length) {
        return fallback.length === 0
          ? fail<T>("OUT_OF_BOUNDS", `No item at index ${index}`)
          : succeed(fallback[0]);
      }
      return succeed(value[at]);
    });
  }) as ListGet<T>;

  return {
    ...base,
    get,
    take(n: number): ListChain<T> {
      return asList(
        chain(base, (value): Fallible<readonly T[]> => {
          if (!isInteger(n)) return fail("INVALID_INDEX", "take needs an integer count");
          if (n < 0 || n > value.length) {
            return fail("OUT_OF_BOUNDS", `take(${n}) is outside 0..${value.length}`);
          }
          return succeed<readonly T[]>(value.slice(0, n));
        }),
      );
    },
    skip(n: number): ListChain<T> {
      return asList(
        chain(base, (value): Fallible<readonly T[]> => {
          if (!isInteger(n)) return fail("INVALID_INDEX", "skip needs an integer count");
          if (Math.abs(n) > value.length) {
            return fail("OUT_OF_BOUNDS", `skip(${n}) is outside -${value.length}..${value.length}`);
          }
          return succeed<readonly T[]>(
            n >= 0 ? value.slice(n) : value.slice(0, value.length + n),
          );
        }),
      );
    },
    range(start: number, end: number): ListChain<T> {
      return asList(
        chain(base, (value): Fallible<readonly T[]> => {
          if (!isInteger(start) || !isInteger(end)) {
            return fail("INVALID_INDEX", "range needs integer bounds");
          }
          const from = normalizeIndex(start, value.length);
          const to = normalizeIndex(end, value.length);
          if (from < 0 || from > value.length || to < 0 || to > value.length) {
            return fail("OUT_OF_BOUNDS", `range(${start}, ${end}) is outside 0..${value.length}`);
          }
          if (from > to) return fail("INVALID_RANGE", "range start must not exceed end");
          return succeed<readonly T[]>(value.slice(from, to));
        }),
      );
    },
    chunk(size: number): ListChain<readonly T[]> {
      const next = chain(base, (value): Fallible<readonly (readonly T[])[]> => {
        if (!isInteger(size) || size <= 0) {
          return fail("INVALID_CHUNK_SIZE", "chunk size must be a positive integer");
        }
        const groups: (readonly T[])[] = [];
        for (let index = 0; index < value.length; index += size) {
          groups.push(value.slice(index, index + size));
        }
        return succeed<readonly (readonly T[])[]>(groups);
      });
      return createList<readonly T[]>(next.outcome, next.category);
    },
    count(): Fallible<number> {
      return chain(base, (value) => succeed(value.length));
    },
    prune(predicate?: (value: T, index: number) => boolean): ListChain<T> {
      return asList(
        chain(base, (value): Fallible<readonly T[]> => {
          const keep = predicate ?? ((item: T) => !isFalsy(item));
          return succeed<readonly T[]>(value.filter((item, index) => keep(item, index)));
        }),
      );
    },
  };
}

/**
 * Wraps a finite array (or a narrowed successful `Ok` holding one) in a list chain.
 * Invalid bounds and counts fail the chain; resolve with `.else(...)` or `.panic(...)`.
 *
 * @example
 * list([10, 20, 30]).take(2).else([]);       // [10, 20]
 * list([10, 20, 30]).range(1, 9).else([]);   // []
 * list([10, 20, 30]).take(2).panic();        // [10, 20]
 */
export function list<T>(input: ListInput<T>): ListChain<T> {
  const resolved = readList(input);
  if (!resolved.ok) {
    return createList<T>(
      Err(resolved.message) as unknown as Result<readonly T[], string>,
      "INVALID_INPUT",
    );
  }
  return createList<T>(Ok(resolved.value) as unknown as Result<readonly T[], string>, undefined);
}
