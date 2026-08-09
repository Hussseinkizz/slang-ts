/**
 * A lifecycle Signal — a trigger that fires once and stays fired.
 *
 * Abort-compatible: structurally an `AbortSignal` plus a `fire()` method,
 * so it can be passed anywhere a native `AbortSignal` is expected
 * (and vice-versa). Wraps AbortController semantics.
 *
 * Consumed by `defer`, `retryUntil`, `channel.when`, and `task.done`.
 */
export type Signal = AbortSignal & {
  /** Fires the signal once. Subsequent calls are no-ops. */
  fire(): void;
};

/**
 * Creates a lifecycle signal.
 *
 * ```ts
 * const signal = createSignal();
 *
 * signal.addEventListener("abort", () => {
 *   println("fired");
 * });
 *
 * signal.fire(); // "fired"
 * signal.aborted; // true
 * ```
 *
 * Listeners are NOT replayed after firing — consumers must check
 * `signal.aborted` synchronously to detect an already-fired signal.
 */
export function createSignal(): Signal {
  const controller = new AbortController();

  return Object.assign(controller.signal, {
    fire: () => controller.abort(),
  }) as Signal;
}
