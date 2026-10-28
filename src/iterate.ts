import { Err } from "./result";
import type { Result } from "./result";
import { createFallible, fail, succeed } from "./fallible";
import type { Fallible, SlangErrorCategory } from "./fallible";
import { describeThrown } from "./internals";

type Producer<E> = () => Iterator<E>;
type Failure = { category: SlangErrorCategory; message: string } | undefined;
type Shared = { consumed: boolean };

/** The element produced when iterating `C`. */
type ElementOf<C> = C extends Iterable<infer E> ? E : never;

/**
 * Lazily transforms a successful Result's collection. Finishing methods resolve with
 * `.else`/`.panic`. The type parameter is the collection, so `Ok(users)` gives
 * `IterateChain<User[]>` and its callbacks receive a `User`.
 */
export type IterateChain<out C> = {
  map<U>(fn: (value: ElementOf<C>, index: number) => U): IterateChain<U[]>;
  filter(fn: (value: ElementOf<C>, index: number) => boolean): IterateChain<C>;
  flatMap<U>(fn: (value: ElementOf<C>, index: number) => Iterable<U>): IterateChain<U[]>;
  take(n: number): IterateChain<C>;
  drop(n: number): IterateChain<C>;
  chunk(size: number): IterateChain<ElementOf<C>[][]>;
  reduce<U>(fn: (acc: U, value: ElementOf<C>, index: number) => U, seed: U): Fallible<U>;
  count(): Fallible<number>;
  toArray(): Fallible<readonly ElementOf<C>[]>;
};

const iterable = <E>(produce: Producer<E>): Iterable<E> => ({ [Symbol.iterator]: produce });

const failed = <T>(failure: { category: SlangErrorCategory; message: string }): Fallible<T> =>
  createFallible(Err(failure.message) as unknown as Result<T, string>, failure.category);

/** Builds a lazy chain over a producer. @internal */
function createIterate<C>(
  produce: Producer<ElementOf<C>>,
  failure: Failure = undefined,
  oneShot = false,
  shared: Shared = { consumed: false },
): IterateChain<C> {
  const wrap = <N>(
    next: Producer<ElementOf<N>>,
    nextFailure: Failure = failure,
  ): IterateChain<N> => createIterate<N>(next, nextFailure, oneShot, shared);

  const start = <T>(
    consume: (iterator: Iterator<ElementOf<C>>) => T,
  ): Fallible<T> => {
    if (failure !== undefined) return failed<T>(failure);
    if (oneShot && shared.consumed) {
      return fail<T>("INVALID_INPUT", "This iterator has already been consumed");
    }

    shared.consumed = true;
    let iterator: Iterator<ElementOf<C>> | undefined;
    try {
      iterator = produce();
      return succeed(consume(iterator));
    } catch (error) {
      return fail("INVALID_INPUT", describeThrown(error));
    } finally {
      iterator?.return?.();
    }
  };

  return {
    map<U>(fn: (value: ElementOf<C>, index: number) => U): IterateChain<U[]> {
      return wrap<U[]>(function* () {
        let index = 0;
        for (const value of iterable(produce)) yield fn(value, index++);
      });
    },
    filter(fn) {
      return wrap<C>(function* () {
        let index = 0;
        for (const value of iterable(produce)) if (fn(value, index++)) yield value;
      });
    },
    flatMap<U>(
      fn: (value: ElementOf<C>, index: number) => Iterable<U>,
    ): IterateChain<U[]> {
      return wrap<U[]>(function* () {
        let index = 0;
        for (const value of iterable(produce)) yield* fn(value, index++);
      });
    },
    take(n) {
      if (!Number.isSafeInteger(n) || n < 0) {
        return wrap<C>(function* () {}, {
          category: "INVALID_INDEX",
          message: "take needs a nonnegative integer",
        });
      }
      return wrap<C>(function* () {
        if (n === 0) return;
        const iterator = iterable(produce)[Symbol.iterator]();
        let taken = 0;
        try {
          while (taken < n) {
            const next = iterator.next();
            if (next.done === true) return;
            yield next.value;
            taken += 1;
          }
        } finally {
          iterator.return?.();
        }
      });
    },
    drop(n) {
      if (!Number.isSafeInteger(n) || n < 0) {
        return wrap<C>(function* () {}, {
          category: "INVALID_INDEX",
          message: "drop needs a nonnegative integer",
        });
      }
      return wrap<C>(function* () {
        let dropped = 0;
        for (const value of iterable(produce)) {
          if (dropped < n) {
            dropped += 1;
            continue;
          }
          yield value;
        }
      });
    },
    chunk(size) {
      if (!Number.isSafeInteger(size) || size <= 0) {
        return wrap<ElementOf<C>[][]>(function* () {}, {
          category: "INVALID_CHUNK_SIZE",
          message: "chunk size must be a positive integer",
        });
      }
      return wrap<ElementOf<C>[][]>(function* () {
        let buffer: ElementOf<C>[] = [];
        for (const value of iterable(produce)) {
          buffer.push(value);
          if (buffer.length === size) {
            yield buffer;
            buffer = [];
          }
        }
        if (buffer.length > 0) yield buffer;
      });
    },
    reduce<U>(fn: (acc: U, value: ElementOf<C>, index: number) => U, seed: U): Fallible<U> {
      return start((iterator) => {
        let accumulator = seed;
        let index = 0;
        for (;;) {
          const next = iterator.next();
          if (next.done === true) return accumulator;
          accumulator = fn(accumulator, next.value, index++);
        }
      });
    },
    count() {
      return start((iterator) => {
        let total = 0;
        for (;;) {
          if (iterator.next().done === true) return total;
          total += 1;
        }
      });
    },
    toArray() {
      return start((iterator) => {
        const values: ElementOf<C>[] = [];
        for (;;) {
          const next = iterator.next();
          if (next.done === true) return values as readonly ElementOf<C>[];
          values.push(next.value);
        }
      });
    },
  };
}

/** Builds a lazy chain from a successful Result's value. @internal */
export function iterateOf<C>(value: unknown): IterateChain<C> {
  const source =
    typeof value === "string" ||
    (value !== null && typeof value === "object" && Symbol.iterator in value)
      ? (value as Iterable<ElementOf<C>>)
      : undefined;

  if (source !== undefined) {
    let oneShot = false;
    try {
      oneShot = (source[Symbol.iterator]() as unknown) === source;
    } catch {
      // The iterator itself is broken; the terminal reports the failure.
    }
    return createIterate<C>(() => source[Symbol.iterator](), undefined, oneShot);
  }

  return createIterate<C>(
    () => {
      throw new Error("Cannot iterate a non-iterable value");
    },
    { category: "INVALID_INPUT", message: "Cannot iterate a non-iterable value" },
  );
}
