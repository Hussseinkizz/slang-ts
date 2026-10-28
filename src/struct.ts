import { isFalsy } from "./option";
import { chain, createFallible, fail, succeed } from "./fallible";
import type { Fallible, SlangErrorCategory } from "./fallible";
import { buildOk, Err } from "./result";
import type { Result, Ok as OkType } from "./result";
import { isResult } from "./internals";

/** Plain-object check, excluding arrays and null. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === "[object Object]";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Deep-merges plain objects; replaces everything else. Never mutates the input. */
function mergeInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const current = out[key];
    out[key] = isRecord(value) && isRecord(current) ? mergeInto(current, value) : value;
  }
  return out;
}

/** The row type of a collection passed to `struct`. */
type StructRow<T> = T extends readonly (infer Row)[] ? Row : unknown;

/** Reads a property path; a known top-level key keeps its value type. */
export type StructGet<T> = T extends readonly unknown[]
  ? {
      (path: string | readonly string[]): Fallible<unknown>;
      <U>(path: string | readonly string[], fallback: U): Fallible<unknown>;
    }
  : {
      <K extends keyof T & string>(path: K): Fallible<T[K]>;
      <K extends keyof T & string, U>(path: K, fallback: U): Fallible<T[K] | U>;
      (path: string | readonly string[]): Fallible<unknown>;
      <U>(path: string | readonly string[], fallback: U): Fallible<unknown>;
    };

/** A successful struct chain plus its record and aggregation operations. */
export type StructChain<T> = Fallible<T> & {
  get: StructGet<T>;
  pick<K extends keyof T & string>(...keys: K[]): StructChain<Pick<T, K>>;
  omit<K extends keyof T & string>(...keys: K[]): StructChain<Omit<T, K>>;
  merge(source: Record<string, unknown>): StructChain<T>;
  count(): Fallible<number>;
  countBy(selector: (row: StructRow<T>) => PropertyKey): Fallible<Record<string, number>>;
  keyBy(selector: (row: StructRow<T>) => PropertyKey): Fallible<Record<string, StructRow<T>>>;
  prune(predicate?: (value: unknown, key: string) => boolean): StructChain<T>;
};

/** Builds a struct chain around an outcome. @internal */
function createStruct<T>(
  outcome: Result<T, string>,
  category: SlangErrorCategory | undefined,
): StructChain<T> {
  const base = createFallible(outcome, category);
  const rebuild = (next: Fallible<unknown>): StructChain<T> =>
    createStruct<T>(next.outcome as unknown as Result<T, string>, next.category);

  const asRecord = (value: T): Record<string, unknown> | undefined =>
    isRecord(value) ? value : undefined;

  const get = ((path: string | readonly string[], ...fallback: [unknown?]): Fallible<unknown> => {
    return chain(base, (value): Fallible<unknown> => {
      const record = asRecord(value);
      if (record === undefined) return fail("INVALID_INPUT", "get expects a plain object");

      const keys = typeof path === "string" ? [path] : path;
      let cursor: unknown = record;
      for (const key of keys) {
        if (!isRecord(cursor) || !Object.hasOwn(cursor, key)) {
          return fallback.length === 0
            ? fail("OUT_OF_BOUNDS", `No value at path ${keys.join(".")}`)
            : succeed(fallback[0]);
        }
        cursor = cursor[key];
      }
      return succeed(cursor);
    });
  }) as StructGet<T>;

  return {
    ...base,
    get,
    pick(...keys) {
      return rebuild(
        chain(base, (value): Fallible<unknown> => {
          const record = asRecord(value);
          if (record === undefined) return fail("INVALID_INPUT", "pick expects a plain object");
          return succeed<unknown>(
            Object.fromEntries(
              keys.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]),
            ),
          );
        }),
      );
    },
    omit(...keys) {
      return rebuild(
        chain(base, (value): Fallible<unknown> => {
          const record = asRecord(value);
          if (record === undefined) return fail("INVALID_INPUT", "omit expects a plain object");
          const dropped = new Set<string>(keys);
          return succeed<unknown>(
            Object.fromEntries(Object.entries(record).filter(([key]) => !dropped.has(key))),
          );
        }),
      );
    },
    merge(source) {
      return rebuild(
        chain(base, (value): Fallible<unknown> => {
          const record = asRecord(value);
          if (record === undefined) return fail("INVALID_INPUT", "merge expects a plain object");
          if (!isRecord(source)) return fail("INVALID_INPUT", "merge expects a plain object source");
          return succeed<unknown>(mergeInto(record, source));
        }),
      );
    },
    count() {
      return chain(base, (value): Fallible<number> => {
        const record = asRecord(value);
        return record === undefined
          ? fail("INVALID_INPUT", "count expects a plain object")
          : succeed(Object.keys(record).length);
      });
    },
    countBy(selector) {
      return chain(base, (value): Fallible<Record<string, number>> => {
        if (!Array.isArray(value)) return fail("INVALID_INPUT", "countBy expects a collection");
        const rows = value as readonly StructRow<T>[];
        const counts = new Map<string, number>();
        for (const row of rows) {
          const key = String(selector(row));
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return succeed(Object.fromEntries(counts) as Record<string, number>);
      });
    },
    keyBy(selector) {
      return chain(base, (value): Fallible<Record<string, StructRow<T>>> => {
        if (!Array.isArray(value)) return fail("INVALID_INPUT", "keyBy expects a collection");
        const rows = value as readonly StructRow<T>[];
        const index = new Map<string, StructRow<T>>();
        for (const row of rows) index.set(String(selector(row)), row);
        return succeed(Object.fromEntries(index) as Record<string, StructRow<T>>);
      });
    },
    prune(predicate) {
      return rebuild(
        chain(base, (value): Fallible<unknown> => {
          const record = asRecord(value);
          if (record === undefined) return fail("INVALID_INPUT", "prune expects a plain object");
          const keep = predicate ?? ((entry: unknown) => !isFalsy(entry));
          return succeed<unknown>(
            Object.fromEntries(
              Object.entries(record).filter(([key, entry]) => keep(entry, key)),
            ),
          );
        }),
      );
    },
  };
}

/** Reads either a raw value or a narrowed successful Ok. */
function readStructInput(
  input: unknown,
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (isResult(input)) {
    if (input.isOk === true) return { ok: true, value: input.value };
    return { ok: false, message: "struct expects a raw value or a successful Ok" };
  }
  return { ok: true, value: input };
}

/**
 * Wraps a record, or a collection of records, in a struct chain.
 * A narrowed successful `Ok` is accepted; an `Err` is refused.
 * Invalid input and missing paths fail the chain; resolve with `.else(...)` or `.panic(...)`.
 *
 * @example
 * struct(user).get(["profile", "city"]).else("unknown");
 * struct(user).pick("id", "name").else({});
 * struct(rows).countBy((row) => row.role).else({});
 */
export function struct<T>(input: OkType<T> & { readonly isOk: true }): StructChain<T>;
export function struct<T extends Record<string, unknown> | readonly unknown[]>(
  input: T,
): StructChain<T>;
export function struct<T>(input: T): StructChain<T> {
  const resolved = readStructInput(input);
  if (!resolved.ok) {
    return createStruct<T>(
      Err(resolved.message) as unknown as Result<T, string>,
      "INVALID_INPUT",
    );
  }
  return createStruct<T>(buildOk(resolved.value as T), undefined);
}

export { createStruct };
