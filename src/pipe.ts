import { Ok, Err } from "./result";
import type { Result } from "./result";
import { evaluateValue, isResult } from "./internals";

/** Function that transforms one Result into another */
export type PipeFn<T = any, E = any> = (
  input: Result<T, E>
) => Result<any, any> | Promise<Result<any, any>>;

/** Context passed to onEach callback */
export type PipeEachContext = {
  prevResult: Result<any, any>;
  currentFn: string;
  nextFn: string | undefined;
};

/** Options for pipeline execution */
export type PipeRunOptions = {
  /** Called after each function executes */
  onEach?: (ctx: PipeEachContext) => void;
  /** Called when pipeline completes successfully */
  onSuccess?: (value: any) => void;
  /** Called when pipeline encounters an error (only when allowErrors is false) */
  onError?: (error: Error) => void;
  /** If true, continues pipeline even when a function returns Err */
  allowErrors?: boolean;
};

/** Pipeline object returned by pipe() */
export type Pipeline<T, E> = {
  run: (options?: PipeRunOptions) => Promise<Result<T, E>>;
};

/** Extracts error string from a Result that is known to be Err */
function getErrorMessage(result: Result<any, any>): string {
  return (result as any).error ?? "Unknown error";
}

/**
 * Normalizes initial value to Result.
 * Handles plain values, Option, Result, and Atom types.
 */
function normalizeToResult<T>(value: T): Result<unknown, string> {
  const evaluated = evaluateValue(value);
  if (evaluated.ok) {
    return Ok(evaluated.value);
  }
  return Err((evaluated as { ok: false; error: string }).error);
}

/**
 * Executes a pipeline function safely, catching any thrown exceptions.
 * Unlike safeTry, this preserves the Result structure returned by the function.
 */
async function executePipeFn(
  fn: PipeFn,
  input: Result<any, any>
): Promise<Result<any, any>> {
  try {
    const result = await fn(input);
    if (!isResult(result)) {
      return Err("Pipeline function must return a Result");
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Err(errorMessage);
  }
}

/**
 * Creates a pipeline for sequential function composition.
 * Each function receives the previous Result and returns a new Result.
 *
 * @param initial - Starting value (plain value, Option, Result, or Atom)
 * @param fns - Pipeline functions that transform Results
 * @returns Pipeline object with `.run()` method
 *
 * @example
 * const add = (x: number) => (res: Result<number, string>) =>
 *   res.isOk ? Ok(res.value + x) : res;
 *
 * const result = await pipe(5, add(3), add(2)).run();
 * // result.value === 10
 *
 * @example
 * const result = await pipe(option(5), add(3)).run({
 *   onEach: ({ currentFn, prevResult }) => console.log(currentFn, prevResult),
 *   onSuccess: (value) => console.log("Done:", value),
 *   allowErrors: false,
 * });
 */
export function pipe<T, E = string>(
  initial: T,
  ...fns: PipeFn[]
): Pipeline<any, E> {
  return {
    async run(options?: PipeRunOptions): Promise<Result<any, E>> {
      const { onEach, onSuccess, onError, allowErrors = false } = options ?? {};

      let currentResult: Result<any, any> = normalizeToResult(initial);

      for (let i = 0; i < fns.length; i++) {
        const fn = fns[i]!;
        const nextFnRef = fns[i + 1];

        // Early exit if error and allowErrors is false
        if (currentResult.isErr && !allowErrors) {
          onError?.(new Error(getErrorMessage(currentResult)));
          return currentResult as Result<any, E>;
        }

        // Execute function, preserving the Result structure
        currentResult = await executePipeFn(fn, currentResult);

        // Invoke onEach after execution
        onEach?.({
          prevResult: currentResult,
          currentFn: fn.name || `fn${i + 1}`,
          nextFn: nextFnRef ? (nextFnRef.name || `fn${i + 2}`) : undefined,
        });
      }

      // Final result handling
      if (currentResult.isOk) {
        onSuccess?.((currentResult as any).value);
      } else {
        onError?.(new Error(getErrorMessage(currentResult)));
      }

      return currentResult as Result<any, E>;
    },
  };
}
