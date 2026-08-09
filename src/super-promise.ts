import { Ok, Err } from "./result";
import type { Result } from "./result";
import { createSignal } from "./signal";
import { evaluateValue, ACTIVATE_HOOK } from "./internals";
import type { Activatable } from "./internals";

/** The operation itself. Receives the attempt's AbortSignal. */
export type Executor<T> = (
  signal: AbortSignal,
) => T | Promise<T> | Result<T, string> | Promise<Result<T, string>>;

/** Stop signal for `retryUntil`. */
export type RetryUntilOptions = {
  /** When this fires, retrying ends — mid-attempt firings cancel the in-flight attempt. */
  signal: AbortSignal;
  /** Wait between attempts. No wait applies before the first attempt. */
  delay?: number;
};

/** Execution policies, configured at construction time. */
export type SuperPromiseOptions = {
  /** Do not execute until this signal fires (accepts SuperPromise signals and AbortSignal). */
  defer?: AbortSignal;
  /** Wait before initial execution; normal retries also wait this long. */
  delay?: number;
  /** Abort the operation after this many milliseconds. Timeouts are never retried. */
  timeout?: number;
  /** `n` retries after the first attempt — `n + 1` attempts total. Aborts and timeouts are never retried. */
  retry?: number;
  /** Keep retrying until the stop signal fires. Overrides `retry` and `delay`. */
  retryUntil?: RetryUntilOptions;
};

/** A single async operation with lifecycle ergonomics. Promise-compatible. */
export type SuperPromise<T> = {
  /** Lifecycle signal: fires once when the task reaches a terminal state. */
  done: AbortSignal;
  /** Cancels the operation; settles with `Err("Aborted")` when not yet settled. */
  abort(): void;
  /** Manually settles an externally controlled task with a value. First settlement wins. */
  resolve(value: T): void;
  /** Manually settles an externally controlled task with a failure. First settlement wins. */
  reject(error: unknown): void;
  /** Observes a successful value without transforming it. Callback throws settle as `Err`. */
  tap(fn: (value: T) => unknown | Promise<unknown>): SuperPromise<T>;
  /** Promise-compatible. The callback receives the settled `Result`; the task never rejects. */
  then<TR1 = Result<T, string>, TR2 = never>(
    onfulfilled?: ((value: Result<T, string>) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): Promise<TR1 | TR2>;
  /** Promise-compatible. Effectively dead — failures are captured into `Err`, never rejections. */
  catch<TR = never>(
    onrejected?: ((reason: unknown) => TR | PromiseLike<TR>) | null,
  ): Promise<Result<T, string> | TR>;
  /** Promise-compatible. Native behavior. */
  finally(onfinally?: (() => void) | null): Promise<Result<T, string>>;
};

const normalizeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Propagates parent abort to a child controller; returns an unlink function. */
const linkAbort = (parent: AbortSignal, child: AbortController): (() => void) => {
  if (parent.aborted) {
    child.abort();
    return () => {};
  }
  const onAbort = () => child.abort();
  parent.addEventListener("abort", onAbort, { once: true });
  return () => parent.removeEventListener("abort", onAbort);
};

/** Single attempt outcome — the retry loop classifies, not the attempt itself. */
type AttemptOutcome<T> =
  | { kind: "value"; value: T }
  | { kind: "error"; error: string }
  | { kind: "aborted" }
  | { kind: "stopped" }
  | { kind: "timedOut" };

/**
 * Creates a SuperPromise — one async operation plus lifecycle/execution ergonomics.
 *
 * Lazy activation: the executor starts on first consumption (`await`/`.then()`,
 * or a runner's `start()`), not at creation. Defer chains activate recursively,
 * so awaiting a deferred task runs its dependency first.
 *
 * @example
 * const task = superPromise(async signal => {
 *   const response = await fetch(url, { signal });
 *   return response.json();
 * });
 *
 * const result = await task; // Result<T, string>
 */
export function superPromise<T>(
  fn: Executor<T>,
  options?: SuperPromiseOptions,
): SuperPromise<T>;
/** Creates an externally controlled SuperPromise, settled via `resolve`/`reject`. */
export function superPromise<T>(
  fn?: undefined,
  options?: SuperPromiseOptions,
): SuperPromise<T>;
export function superPromise<T>(
  fn?: Executor<T>,
  options: SuperPromiseOptions = {},
): SuperPromise<T> {
  const controller = new AbortController();
  const done = createSignal();
  let settle: (result: Result<T, string>) => void = () => {};
  const promise = new Promise<Result<T, string>>((resolve) => {
    settle = resolve;
  });
  let activated = false;
  let settled = false;

  const finalize = (result: Result<T, string>): void => {
    if (settled) return;
    settled = true;
    settle(result);
    done.fire();
  };

  /** Executes one attempt with its own AbortController; timeout/stop abort the attempt. */
  const runAttempt = async (
    executor: Executor<T>,
    attempt: AbortController,
    stop: AbortSignal | undefined,
  ): Promise<AttemptOutcome<T>> => {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unlinkStop = stop !== undefined ? linkAbort(stop, attempt) : () => {};
    const unlinkMaster = linkAbort(controller.signal, attempt);
    if (options.timeout !== undefined) {
      timer = setTimeout(() => {
        timedOut = true;
        attempt.abort();
      }, options.timeout);
    }

    const finish = (outcome: AttemptOutcome<T>): AttemptOutcome<T> => {
      if (timer !== undefined) clearTimeout(timer);
      unlinkStop();
      unlinkMaster();
      return outcome;
    };

    try {
      const raw = await executor(attempt.signal);
      const evaluated = evaluateValue(raw);
      if (attempt.signal.aborted) {
        if (controller.signal.aborted) return finish({ kind: "aborted" });
        if (stop?.aborted) return finish({ kind: "stopped" });
        return finish(timedOut ? { kind: "timedOut" } : { kind: "aborted" });
      }
      if (!evaluated.ok) return finish({ kind: "error", error: evaluated.error });
      return finish({ kind: "value", value: evaluated.value as T });
    } catch (error) {
      if (controller.signal.aborted) return finish({ kind: "aborted" });
      if (stop?.aborted) return finish({ kind: "stopped" });
      if (attempt.signal.aborted) {
        return finish(timedOut ? { kind: "timedOut" } : { kind: "aborted" });
      }
      return finish({ kind: "error", error: normalizeError(error) });
    }
  };

  /** Waits until a signal fires (or the master aborts). Activates deferred task sources. */
  const waitForSignal = (signal: AbortSignal): Promise<void> =>
    new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      (signal as Activatable)[ACTIVATE_HOOK]?.();
      const wake = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        signal.removeEventListener("abort", wake);
        controller.signal.removeEventListener("abort", wake);
      };
      signal.addEventListener("abort", wake, { once: true });
      controller.signal.addEventListener("abort", wake, { once: true });
    });

  /** Waits milliseconds, waking early on master abort. */
  const waitForDelay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (controller.signal.aborted) {
        resolve();
        return;
      }
      const wake = () => {
        clearTimeout(timer);
        cleanup();
        resolve();
      };
      const cleanup = () => controller.signal.removeEventListener("abort", wake);
      const timer = setTimeout(wake, ms);
      controller.signal.addEventListener("abort", wake, { once: true });
    });

  const execute = async (): Promise<void> => {
    const { defer, delay, retry, retryUntil } = options;
    const executor = fn;
    if (executor === undefined) return;

    if (controller.signal.aborted) return finalize(Err("Aborted"));
    if (defer !== undefined) {
      await waitForSignal(defer);
      if (controller.signal.aborted) return finalize(Err("Aborted"));
    }

    if (retryUntil !== undefined) {
      const stop = retryUntil.signal;
      for (;;) {
        if (controller.signal.aborted) return finalize(Err("Aborted"));
        if (stop.aborted) return finalize(Err("Stopped"));
        const attempt = new AbortController();
        const outcome = await runAttempt(executor, attempt, stop);
        switch (outcome.kind) {
          case "value":
            return finalize(Ok(outcome.value));
          case "aborted":
            return finalize(Err("Aborted"));
          case "stopped":
            return finalize(Err("Stopped"));
          case "timedOut":
          case "error": {
            if (controller.signal.aborted) return finalize(Err("Aborted"));
            if (stop.aborted) return finalize(Err("Stopped"));
            if (retryUntil.delay !== undefined) await waitForDelay(retryUntil.delay);
          }
        }
      }
    }

    if (retry !== undefined && retry > 0) {
      let retriesLeft = retry;
      for (;;) {
        if (controller.signal.aborted) return finalize(Err("Aborted"));
        if (delay !== undefined) await waitForDelay(delay);
        if (controller.signal.aborted) return finalize(Err("Aborted"));
        const attempt = new AbortController();
        const outcome = await runAttempt(executor, attempt, undefined);
        switch (outcome.kind) {
          case "value":
            return finalize(Ok(outcome.value));
          case "aborted":
            return finalize(Err("Aborted"));
          case "timedOut":
            return finalize(Err("Timed out"));
          case "stopped":
            return finalize(Err("Stopped"));
          case "error":
            if (retriesLeft > 0) {
              retriesLeft -= 1;
              continue;
            }
            return finalize(Err(outcome.error));
        }
      }
    }

    if (delay !== undefined) await waitForDelay(delay);
    if (controller.signal.aborted) return finalize(Err("Aborted"));
    const attempt = new AbortController();
    const outcome = await runAttempt(executor, attempt, undefined);
    switch (outcome.kind) {
      case "value":
        return finalize(Ok(outcome.value));
      case "aborted":
        return finalize(Err("Aborted"));
      case "timedOut":
        return finalize(Err("Timed out"));
      case "stopped":
        return finalize(Err("Stopped"));
      case "error":
        return finalize(Err(outcome.error));
    }
  };

  const activate = (): void => {
    if (activated) return;
    activated = true;
    if (fn === undefined) return;
    void execute();
  };

  (done as unknown as Activatable)[ACTIVATE_HOOK] = activate;

  const abort = (): void => {
    controller.abort();
    finalize(Err("Aborted"));
  };

  const task: SuperPromise<T> = {
    done,
    abort,
    resolve: (value: T): void => finalize(Ok(value)),
    reject: (error: unknown): void => finalize(Err(normalizeError(error))),
    tap: (fn: (value: T) => unknown | Promise<unknown>): SuperPromise<T> =>
      superPromise<T>(async (): Promise<Result<T, string>> => {
        const result = await task;
        if (result.isOk) {
          await fn(result.value);
        }
        return result;
      }),
    then: (onfulfilled, onrejected) => {
      activate();
      return promise.then(onfulfilled, onrejected);
    },
    catch: (onrejected) => {
      activate();
      return promise.catch(onrejected);
    },
    finally: (onfinally) => {
      activate();
      return promise.finally(onfinally);
    },
  };

  return task;
}
