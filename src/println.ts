export type EnvironmentMode = "development" | "production" | "dev" | "prod";

export type PrintFn = (line: string) => void;

export type EnvironmentOptions = { printFn?: PrintFn | null };

let mode: "development" | "production" = "development";
let printFn: PrintFn | null = null;

/**
 * Sets the runtime environment for dev-only utilities.
 * Idempotent — safe to call any number of times, in any order; the last call wins.
 * Accepts a mode (full words or short forms: "development"/"dev", "production"/"prod")
 * or options `{ printFn }` to route println through an existing logger instead of
 * the console — useful in production, where logs go somewhere real.
 * Pass `{ printFn: null }` to switch back to the console.
 */
export const setEnvironment = (next: EnvironmentMode | EnvironmentOptions): void => {
  if (typeof next === "object" && next !== null) {
    printFn = next.printFn ?? null;
    return;
  }
  mode = next === "production" || next === "prod" ? "production" : "development";
};

const toPrintable = (arg: unknown): string => {
  if (typeof arg === "string") return arg;
  if (typeof arg === "symbol") return String(arg);
  if (typeof arg === "function") return `[Function ${arg.name}]`;
  try {
    return String(arg);
  } catch {
    try {
      return JSON.stringify(arg) ?? "null";
    } catch {
      return Object.prototype.toString.call(arg);
    }
  }
};

/**
 * Prints a line to the console — args joined with spaces, newline appended.
 * When a custom printFn is set, the line goes to it instead, in every mode.
 * Otherwise production mode is silent, so dev chatter never leaks to prod logs.
 */
export const println = (...args: unknown[]): void => {
  const line = args.map(toPrintable).join(" ").concat("\n");
  if (printFn) {
    printFn(line);
    return;
  }
  if (mode === "production") return;
  globalThis.console?.log?.(line);
};
