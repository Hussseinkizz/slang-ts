/** Options for a shared task group. */
export type TaskGroupOptions = {
  /** Maximum tasks active at once. Defaults to unlimited. */
  concurrency?: number;
  /** Minimum milliseconds between admitted starts. Defaults to 0. */
  throttle?: number;
};

/** A shared scheduler that tasks and runners can coordinate through. */
export type TaskGroup = {
  readonly name: string;
  /**
   * Waits for admission, then returns a release callback.
   * A retry is a new admission and must call this again.
   */
  acquire(): Promise<() => void>;
};

/**
 * Creates a shared task group enforcing concurrency and start spacing.
 * A group does not cancel running work and does not manage idempotency.
 *
 * @example
 * const api = taskGroup("upstream", { concurrency: 3, throttle: 200 });
 * superPromise(fetchUsers, { group: api });
 */
export function taskGroup(name: string, options: TaskGroupOptions = {}): TaskGroup {
  const concurrency = options.concurrency ?? Number.POSITIVE_INFINITY;
  const throttle = options.throttle ?? 0;

  if (concurrency !== Number.POSITIVE_INFINITY) {
    if (!Number.isSafeInteger(concurrency) || concurrency <= 0) {
      throw new Error("concurrency must be a positive integer");
    }
  }
  if (!Number.isSafeInteger(throttle) || throttle < 0) {
    throw new Error("throttle must be a nonnegative integer");
  }

  let active = 0;
  let lastStart = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waiters: Array<() => void> = [];

  const schedule = (delay: number) => {
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      pump();
    }, delay);
  };

  const pump = () => {
    while (waiters.length > 0 && active < concurrency) {
      const wait = throttle > 0 ? Math.max(0, lastStart + throttle - Date.now()) : 0;
      if (wait > 0) {
        schedule(wait);
        return;
      }

      const grant = waiters.shift();
      if (grant === undefined) return;

      active += 1;
      lastStart = Date.now();
      grant();

      if (throttle > 0) {
        schedule(throttle);
        return;
      }
    }
  };

  const release = (): (() => void) => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (active > 0) active -= 1;
      pump();
    };
  };

  return {
    name,
    acquire(): Promise<() => void> {
      return new Promise((resolve) => {
        waiters.push(() => resolve(release()));
        pump();
      });
    },
  };
}
