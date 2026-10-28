/** A memoized function that also exposes `clear()`. */
export type Memoized<Args extends unknown[], R> = ((...args: Args) => R) & {
  clear(): void;
};

const LEAF = Symbol("slang.memo.leaf");

/**
 * Caches a function's result by its arguments.
 * Primitives compare by value (SameValueZero); objects compare by identity.
 * `undefined` is a cacheable result; a thrown error is not cached; a rejected
 * Promise is removed from the cache so a later call can retry.
 *
 * @example
 * const add = memoized((a: number, b: number) => a + b);
 * add(1, 2); // computes
 * add(1, 2); // cache hit
 * add.clear();
 */
export function memoized<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): Memoized<Args, R> {
  let root = new Map<unknown, unknown>();

  const walk = (args: readonly unknown[]): Map<unknown, unknown> => {
    let node = root;
    for (const arg of args) {
      let next = node.get(arg) as Map<unknown, unknown> | undefined;
      if (next === undefined) {
        next = new Map();
        node.set(arg, next);
      }
      node = next;
    }
    return node;
  };

  const memo = ((...args: Args): R => {
    const leaf = walk(args);
    if (leaf.has(LEAF)) return leaf.get(LEAF) as R;

    const value = fn(...args);
    leaf.set(LEAF, value);

    if (value instanceof Promise) {
      value.catch(() => {
        leaf.delete(LEAF);
      });
    }
    return value;
  }) as Memoized<Args, R>;

  memo.clear = () => {
    root = new Map();
  };

  return memo;
}
