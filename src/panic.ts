/**
 * Throws an error immediately.
 * Use for unrecoverable failures or guard clauses.
 * @param message - Error message
 * @example
 * panic("Critical!");
 * 
 * // Guard clause pattern
 * if (!config.apiKey) panic("API key required");
 */
export function panic(message: string): never {
  throw new Error(message);
}
