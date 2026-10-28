import { Err } from "./result";
import { buildOk } from "./result";
import type { Result, Ok as OkType } from "./result";
import { chain, createFallible, fail, succeed } from "./fallible";
import type { Fallible, SlangErrorCode } from "./fallible";
import { isResult } from "./internals";

/** Accepted set input: any iterable, Set, Map (keys), plain object (keys), or a narrowed Ok. */
export type SetsInput =
  | Iterable<unknown>
  | Set<unknown>
  | ReadonlyMap<unknown, unknown>
  | Record<string, unknown>
  | (OkType<
      Iterable<unknown> | Set<unknown> | ReadonlyMap<unknown, unknown> | Record<string, unknown>
    > & {
      readonly isOk: true;
    });

/** The element type a supported set input contributes. */
type SetsElement<I> = I extends OkType<infer V>
  ? SetsElement<V>
  : I extends ReadonlyMap<infer K, unknown>
    ? K
    : I extends Set<infer V>
      ? V
      : I extends Iterable<infer V>
        ? V
        : I extends Record<string, unknown>
          ? string
          : never;

/** Normalizes a supported input to a native Set, or undefined. */
function normalize<T>(value: unknown): Set<T> | undefined {
  if (value instanceof Set) return new Set(value) as Set<T>;
  if (value instanceof Map) return new Set(value.keys()) as Set<T>;
  if (typeof value === "string") return new Set(value) as Set<T>;
  if (value !== null && typeof value === "object") {
    if (Symbol.iterator in value) return new Set(value as Iterable<T>);
    if (Object.prototype.toString.call(value) === "[object Object]") {
      return new Set(Object.keys(value)) as unknown as Set<T>;
    }
  }
  return undefined;
}

/** Resolves a raw input or a narrowed Ok holding one. */
function resolveInput(
  input: unknown,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (isResult(input)) {
    if (input.isOk !== true) {
      return { ok: false, message: "sets expects a raw collection or a successful Ok" };
    }
    return { ok: true, value: input.value };
  }
  return { ok: true, value: input };
}

/** A successful set chain plus membership and algebra operations. */
export type SetsChain<T = unknown> = Fallible<Set<T>> & {
  has(value: T): Fallible<boolean>;
  unique(): SetsChain<T>;
  union<I extends SetsInput>(other: I): SetsChain<T | SetsElement<I>>;
  intersection<I extends SetsInput>(other: I): SetsChain<T>;
  difference<I extends SetsInput>(other: I): SetsChain<T>;
  count(): Fallible<number>;
};

/** Builds a set chain around an outcome. @internal */
function createSets<T>(
  outcome: Result<Set<T>, string>,
  code: SlangErrorCode | undefined,
): SetsChain<T> {
  const base = createFallible(outcome, code);
  const asSets = <U>(next: Fallible<Set<U>>): SetsChain<U> =>
    createSets<U>(next.outcome, next.code);

  const combine = <U, R>(
    other: SetsInput,
    op: (left: Set<T>, right: Set<U>) => Set<R>,
  ): SetsChain<R> =>
    asSets(
      chain(base, (value): Fallible<Set<R>> => {
        const resolved = resolveInput(other);
        const right = resolved.ok ? normalize<U>(resolved.value) : undefined;
        return right === undefined
          ? fail("INVALID_INPUT", "sets expects an iterable, set, map or object")
          : succeed(op(value, right));
      }),
    );

  return {
    ...base,
    has(value: T): Fallible<boolean> {
      return chain(base, (set) => succeed(set.has(value)));
    },
    unique(): SetsChain<T> {
      return asSets(chain(base, (set) => succeed(new Set<T>(set))));
    },
    union<I extends SetsInput>(other: I): SetsChain<T | SetsElement<I>> {
      return combine<SetsElement<I>, T | SetsElement<I>>(
        other,
        (left, right) => new Set<T | SetsElement<I>>([...left, ...right]),
      );
    },
    intersection<I extends SetsInput>(other: I): SetsChain<T> {
      return combine<SetsElement<I>, T>(
        other,
        (left, right) => new Set<T>([...left].filter((item) => right.has(item as never))),
      );
    },
    difference<I extends SetsInput>(other: I): SetsChain<T> {
      return combine<SetsElement<I>, T>(
        other,
        (left, right) => new Set<T>([...left].filter((item) => !right.has(item as never))),
      );
    },
    count(): Fallible<number> {
      return chain(base, (set) => succeed(set.size));
    },
  };
}

/**
 * Wraps a collection in a set chain. Object input means its own enumerable keys.
 * Resolve with `.else(...)` or `.panic(...)`.
 *
 * @example
 * sets({ read: true, write: false }).has("write").else(false); // true
 * sets([1, 2, 2, 3]).unique().else(new Set());                 // Set(1, 2, 3)
 */
export function sets(input: Record<string, unknown>): SetsChain<string>;
export function sets<K>(input: ReadonlyMap<K, unknown>): SetsChain<K>;
export function sets<T>(input: Set<T> | Iterable<T>): SetsChain<T>;
export function sets(
  input: OkType<Record<string, unknown>> & { readonly isOk: true },
): SetsChain<string>;
export function sets<K>(
  input: OkType<ReadonlyMap<K, unknown>> & { readonly isOk: true },
): SetsChain<K>;
export function sets<T>(
  input: OkType<Set<T> | Iterable<T>> & { readonly isOk: true },
): SetsChain<T>;
export function sets(input: SetsInput): SetsChain<unknown> {
  const resolved = resolveInput(input);
  if (!resolved.ok) {
    return createSets(
      Err(resolved.message) as unknown as Result<Set<unknown>, string>,
      "INVALID_INPUT",
    );
  }
  const set = normalize(resolved.value);
  if (set === undefined) {
    return createSets(
      Err("sets expects an iterable, set, map or object") as unknown as Result<
        Set<unknown>,
        string
      >,
      "INVALID_INPUT",
    );
  }
  return createSets(buildOk(set), undefined);
}
