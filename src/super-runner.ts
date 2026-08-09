import { Ok, Err } from "./result";
import type { Result } from "./result";
import { createSignal } from "./signal";
import { ACTIVATE_HOOK } from "./internals";
import type { Activatable } from "./internals";
import type { SuperPromise } from "./super-promise";

/** Sequence result: positional tuple of the runners' Ok values. */
type TupleValues<R extends readonly SuperPromise<unknown>[]> = {
  -readonly [K in keyof R]: R[K] extends SuperPromise<infer T> ? T : never;
};

/** all/race result: named object of the runners' Ok values. */
type NamedValues<R extends Record<string, SuperPromise<unknown>>> = {
  [K in keyof R]: R[K] extends SuperPromise<infer T> ? T : never;
};

/** race(count: 1) result: union of single-winner objects. */
type RaceValues<
  C extends number,
  R extends Record<string, SuperPromise<unknown>>,
> = C extends 1
  ? { [K in keyof R]: { [P in K]: R[K] extends SuperPromise<infer T> ? T : never } }[keyof R]
  : Partial<NamedValues<R>>;

/** Orchestrates multiple already-created SuperPromises. */
export type SuperRunner<Value> = {
  /** Lifecycle signal: fires once when the runner reaches a terminal state. */
  done: AbortSignal;
  /** Starts execution. Idempotent: repeated calls return the same result without re-executing children. */
  start(): Promise<Result<Value, string>>;
  /** Cancels the runner and all active children; settles with `Err("Aborted")`. */
  abort(): void;
};

/** Runs runners in order; stops at the first failure. */
export function superRunner<const R extends readonly SuperPromise<unknown>[]>(
  config: { type: "sequence"; runners: R },
): SuperRunner<TupleValues<R>>;
/** Runs runners concurrently; fails fast on the first failure, aborting remaining children. */
export function superRunner<const R extends Record<string, SuperPromise<unknown>>>(
  config: { type: "all"; runners: R },
): SuperRunner<NamedValues<R>>;
/** Runs runners concurrently; first `count` successful completions win, remaining children are aborted. */
export function superRunner<
  const C extends number,
  const R extends Record<string, SuperPromise<unknown>>,
>(
  config: { type: "race"; count: C; runners: R },
): SuperRunner<RaceValues<C, R>>;
export function superRunner(
  config:
    | { type: "sequence"; runners: readonly SuperPromise<unknown>[] }
    | { type: "all"; runners: Record<string, SuperPromise<unknown>> }
    | { type: "race"; count: number; runners: Record<string, SuperPromise<unknown>> },
): SuperRunner<unknown> {
  const { type } = config;

  if (type === "race" && config.count < 1) {
    throw new Error("superRunner race count must be at least 1");
  }

  const controller = new AbortController();
  const done = createSignal();
  let resolveSettle: (result: Result<unknown, string>) => void = () => {};
  const promise = new Promise<Result<unknown, string>>((resolve) => {
    resolveSettle = resolve;
  });
  let activated = false;
  let settled = false;

  const settle = (result: Result<unknown, string>): void => {
    if (settled) return;
    settled = true;
    resolveSettle(result);
    done.fire();
  };

  const children: readonly SuperPromise<unknown>[] =
    type === "sequence" ? config.runners : Object.values(config.runners);

  const abortChildren = (): void => {
    for (const child of children) child.abort();
  };

  const runSequence = async (
    runners: readonly SuperPromise<unknown>[],
  ): Promise<void> => {
    const values: unknown[] = [];
    for (const child of runners) {
      if (controller.signal.aborted) return settle(Err("Aborted"));
      const result = await child;
      if (controller.signal.aborted) return settle(Err("Aborted"));
      if (result.isErr) return settle(Err(result.error));
      values.push(result.value);
    }
    settle(Ok(values));
  };

  const runAll = async (runners: Record<string, SuperPromise<unknown>>): Promise<void> => {
    const entries = Object.entries(runners);
    const values: Record<string, unknown> = {};
    let completed = 0;

    for (const [key, child] of entries) {
      void child.then((result) => {
        completed += 1;
        if (result.isOk) {
          values[key] = result.value;
        } else if (!controller.signal.aborted && !settled) {
          abortChildren();
          settle(Err(result.error));
          return;
        }
        if (completed === entries.length) settle(Ok(values));
      });
    }

    if (entries.length === 0) settle(Ok(values));
  };

  const runRace = async (
    runners: Record<string, SuperPromise<unknown>>,
    count: number,
  ): Promise<void> => {
    const entries = Object.entries(runners);
    const winners: Record<string, unknown> = {};
    let winnerCount = 0;
    let completed = 0;

    for (const [key, child] of entries) {
      void child.then((result) => {
        completed += 1;
        if (result.isOk) {
          winners[key] = result.value;
          winnerCount += 1;
          if (winnerCount >= count) {
            abortChildren();
            settle(Ok(winners));
            return;
          }
        }
        if (completed === entries.length) {
          const message =
            winnerCount === 0 ? "All runners failed" : "Not enough runners succeeded";
          settle(Err(message));
        }
      });
    }

    if (entries.length === 0) settle(Err("All runners failed"));
  };

  const start = (): Promise<Result<unknown, string>> => {
    if (!activated) {
      activated = true;
      if (type === "sequence") {
        void runSequence(config.runners);
      } else if (type === "all") {
        void runAll(config.runners);
      } else {
        void runRace(config.runners, config.count);
      }
    }
    return promise;
  };

  (done as unknown as Activatable)[ACTIVATE_HOOK] = start;

  return {
    done,
    start,
    abort: (): void => {
      controller.abort();
      abortChildren();
      settle(Err("Aborted"));
    },
  };
}
