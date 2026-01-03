/**
 * Schedules a microtask; falls back to Promise if unavailable.
 * Used internally for deferred error handling in unwrap chains.
 */
export const scheduleMicrotask = (fn: () => void) => {
  const qmt = (globalThis as any)?.queueMicrotask as (
    cb: () => void,
  ) => void | undefined;
  if (typeof qmt === "function") qmt(fn);
  else Promise.resolve().then(fn);
};
