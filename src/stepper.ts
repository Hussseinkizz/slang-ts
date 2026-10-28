import { Err, buildOk } from "./result";
import type { Result } from "./result";
import { describeThrown } from "./internals";

/** A named step value. */
export type Step<T> = { key: string; value: T };
/** Builds a candidate step from one named object. */
export type StepFactory<T> = (step: Step<T>) => Step<T>;
/** Computes the next step from the current one. */
export type StepFn<T> = (
  previous: Step<T> | undefined,
  make: StepFactory<T>,
) => Step<T> | Promise<Step<T>>;
/** Reconstructs an evicted step from its nearest retained neighbors. */
export type PrevRecover<T> = (
  previous: Step<T> | undefined,
  make: StepFactory<T>,
  next: Step<T> | undefined,
) => Step<T>;

/** Stepper configuration. */
export type StepperConfig = {
  /** Retained step values. Defaults to 50. */
  maxHistory?: number;
  /** Successful forward commits over the Stepper's lifetime. `null` is unlimited. Defaults to `null`. */
  maxSteps?: number | null;
  /** Optional extra acceptance check for a step key. */
  keyEvalFn?: (key: string) => boolean | Promise<boolean>;
};

/** Options for `next`. */
export type NextOptions = { fallback?: boolean };

/** A backward navigation that must be finished with `.else(...)` or `.panic(...)`. */
export type PrevResolution<T> = {
  else(recover: PrevRecover<T>): Step<T>;
  panic(message?: string): Step<T>;
};

/** A small navigable history engine. */
export type Stepper<T> = {
  next(fn: StepFn<T>, options?: NextOptions): Promise<Result<Step<T>, string>>;
  prev(offset?: number): PrevResolution<T>;
  readonly current: Step<T> | undefined;
  readonly size: number;
};

const DEFAULT_MAX_HISTORY = 50;

const isStep = (value: unknown): value is Step<unknown> =>
  value !== null &&
  typeof value === "object" &&
  typeof (value as { key?: unknown }).key === "string" &&
  (value as { key: string }).key.length > 0 &&
  "value" in value;

const hasKey = <T>(history: Map<number, Step<T>>, key: string): boolean => {
  for (const step of history.values()) if (step.key === key) return true;
  return false;
};

/** Lowest logical index still retained. */
const lowestIndex = <T>(history: Map<number, Step<T>>): number =>
  history.size === 0 ? Number.POSITIVE_INFINITY : Math.min(...history.keys());

/** Highest logical index still retained. */
const highestIndex = <T>(history: Map<number, Step<T>>): number =>
  history.size === 0 ? Number.NEGATIVE_INFINITY : Math.max(...history.keys());

/** Nearest retained step below `index`. */
const stepBelow = <T>(history: Map<number, Step<T>>, index: number): Step<T> | undefined => {
  let best: number | undefined;
  for (const key of history.keys()) {
    if (key < index && (best === undefined || key > best)) best = key;
  }
  return best === undefined ? undefined : history.get(best);
};

/** Nearest retained step above `index`. */
const stepAbove = <T>(history: Map<number, Step<T>>, index: number): Step<T> | undefined => {
  let best: number | undefined;
  for (const key of history.keys()) {
    if (key > index && (best === undefined || key < best)) best = key;
  }
  return best === undefined ? undefined : history.get(best);
};

/**
 * Creates a keyed step navigator with bounded retained history.
 *
 * @example
 * const steps = createStepper({ maxHistory: 50 });
 * const step = await steps.next((prev, make) => make({ key: "start", value: 1 }));
 * const again = steps.prev().else((prev, make) => make({ key: "restored", value: 0 }));
 */
export function createStepper<T>(config: StepperConfig = {}): Stepper<T> {
  const maxHistory = config.maxHistory ?? DEFAULT_MAX_HISTORY;
  const maxSteps = config.maxSteps ?? null;
  const keyEvalFn = config.keyEvalFn;

  if (!Number.isSafeInteger(maxHistory) || maxHistory <= 0) {
    throw new Error("maxHistory must be a positive integer");
  }
  if (maxSteps !== null && (!Number.isSafeInteger(maxSteps) || maxSteps < 0)) {
    throw new Error("maxSteps must be a nonnegative integer or null");
  }

  /** Retained values by logical position; evicted positions simply have no entry. */
  const history = new Map<number, Step<T>>();
  let position = -1;
  let generated = 0;
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs forward generations one at a time so key checks and limits stay consistent. */
  const serialize = <R>(run: () => Promise<R>): Promise<R> => {
    const currentRun = queue.then(run, run);
    queue = currentRun.then(
      () => undefined,
      () => undefined,
    );
    return currentRun;
  };

  const commit = (step: Step<T>): void => {
    for (const index of [...history.keys()]) {
      if (index > position) history.delete(index);
    }

    position += 1;
    history.set(position, step);
    generated += 1;

    while (history.size > maxHistory) {
      const oldest = lowestIndex(history);
      if (oldest === position) break;
      history.delete(oldest);
    }
  };

  const runNext = async (
    fn: StepFn<T>,
    options: NextOptions,
  ): Promise<Result<Step<T>, string>> => {
    const fallback = options.fallback ?? false;
    const currentStep = history.get(position);

    const recover = (message: string): Result<Step<T>, string> => {
      if (fallback && currentStep !== undefined) return buildOk(currentStep);
      return Err(message) as unknown as Result<Step<T>, string>;
    };

    if (maxSteps !== null && generated >= maxSteps) {
      return Err("Step limit reached") as unknown as Result<Step<T>, string>;
    }

    let candidate: unknown;
    try {
      candidate = await fn(currentStep, (step) => step);
    } catch (error) {
      return recover(describeThrown(error));
    }

    if (!isStep(candidate)) return recover("A step needs a nonempty string key and a value");
    const step = candidate as Step<T>;

    if (hasKey(history, step.key)) {
      throw new Error(`Duplicate step key: ${step.key}`);
    }

    if (keyEvalFn !== undefined) {
      let accepted: boolean;
      try {
        accepted = await keyEvalFn(step.key);
      } catch (error) {
        return recover(describeThrown(error));
      }
      if (!accepted) throw new Error(`Step key rejected: ${step.key}`);
    }

    commit(step);
    return buildOk(step);
  };

  const next = (fn: StepFn<T>, options: NextOptions = {}): Promise<Result<Step<T>, string>> =>
    serialize(() => runNext(fn, options));

  const prev = (offset = -1): PrevResolution<T> => {
    if (!Number.isSafeInteger(offset) || offset >= 0) {
      throw new Error("prev offset must be a negative integer");
    }

    const target = position + offset;
    const beforeBeginning = target < 0;

    const settle = (step: Step<T>): Step<T> => {
      position = target;
      return step;
    };

    const reconstruct = (recover: PrevRecover<T>): Step<T> => {
      if (beforeBeginning) throw new Error("Cannot step before the first step");

      const candidate = recover(stepBelow(history, target), (step) => step, stepAbove(history, target));
      if (!isStep(candidate)) throw new Error("Recovered step is invalid");

      const step = candidate as Step<T>;
      if (hasKey(history, step.key)) {
        throw new Error(`Duplicate step key: ${step.key}`);
      }

      history.set(target, step);
      while (history.size > maxHistory) {
        const newest = highestIndex(history);
        if (newest === target) break;
        history.delete(newest);
      }
      return settle(step);
    };

    return {
      else(recover: PrevRecover<T>): Step<T> {
        const known = history.get(target);
        return known !== undefined ? settle(known) : reconstruct(recover);
      },
      panic(message?: string): Step<T> {
        const known = history.get(target);
        if (known !== undefined) return settle(known);
        if (beforeBeginning) throw new Error(message ?? "Cannot step before the first step");
        throw new Error(message ?? "History unavailable");
      },
    };
  };

  return {
    next,
    prev,
    get current() {
      return history.get(position);
    },
    get size() {
      return history.size;
    },
  };
}
