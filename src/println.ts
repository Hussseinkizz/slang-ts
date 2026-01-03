/**
 * Logs the provided arguments to the console.
 * - Uses `globalThis.console.log` if available.
 * - Supports variadic arguments.
 * @param args - The arguments to log. Can be of any type.
 */
export const println = (...args: unknown[]): void => {
  (globalThis as any)?.console?.log?.(...args);
};
