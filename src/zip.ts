/**
 * Converts an input to array of values.
 * - Extracts values from arrays, Sets, or objects based on `includeValues` flag.
 * - Guards against type mismatches when `includeValues` is false.
 * @param input Array, Set, or Object to convert
 * @param includeValues If false (default), only arrays allowed; if true, also extracts values from Sets/Objects
 * @returns Array of values extracted from input
 */
function toArray<T>(
  input: Iterable<T> | { [key: string]: T },
  includeValues = false,
): T[] {
  if (!includeValues && !Array.isArray(input)) {
    throw new Error("Only arrays allowed when includeValues=false");
  }
  if (Array.isArray(input)) return input;
  if (input instanceof Set) return Array.from(input);
  return Object.values(input);
}

/**
 * Combines multiple collections element-wise into tuples.
 * - All inputs must be the same type (all arrays, all Sets, or all objects).
 * - By default, only arrays are allowed; set `includeValues: true` to extract values from Sets/Objects.
 * - Stops at shortest collection by default; use `fillValue` to extend to longest.
 * - Transforms columns into rows for parallel iteration.
 * @param inputs Collections of the same type to combine
 * @param options Configuration: `fillValue` extends to longest, `includeValues` extracts values from Sets/Objects (default: false)
 * @returns Array of tuples, one per index position
 * @example
 * zip([[1, 2], ['a', 'b']]); // [[1, 'a'], [2, 'b']]
 * zip([[1, 2], ['a']], { fillValue: 'x' }); // [[1, 'a'], [2, 'x']]
 * const s1 = new Set([1, 2]); const s2 = new Set([3, 4]);
 * zip([s1, s2], { includeValues: true }); // [[1, 3], [2, 4]]
 */
export function zip<T extends readonly any[]>(
  inputs: { [K in keyof T]: Iterable<T[K]> | { [key: string]: T[K] } },
  options?: { fillValue?: T[number]; includeValues?: boolean },
): T[number][][] {
  const { fillValue, includeValues = false } = options || {};
  if (inputs.length === 0) return [];

  const arrays = inputs.map((inp) => toArray(inp, includeValues));
  const maxLength = Math.max(...arrays.map((a) => a.length));
  const minLength = Math.min(...arrays.map((a) => a.length));
  const length = fillValue === undefined ? minLength : maxLength;

  const result: T[number][][] = [];
  for (let i = 0; i < length; i++) {
    result.push(
      arrays.map((a) => (i < a.length ? a[i] : fillValue!)) as T[number][],
    );
  }
  return result;
}

/**
 * Combines multiple collections element-wise and transforms each tuple.
 * - All inputs must be the same type (all arrays, all Sets, or all objects).
 * - By default, only arrays are allowed; set `includeValues: true` to extract values from Sets/Objects.
 * - Applies a function to each set of corresponding elements.
 * - Useful for aggregating, computing, or transforming aligned data.
 * @param inputs Collections of the same type to combine
 * @param fn Transform function applied to each tuple
 * @param options Configuration: `fillValue` extends to longest, `includeValues` extracts values from Sets/Objects (default: false)
 * @returns Array of transformed results
 * @example
 * zipWith([[1, 2], [3, 4]], (t) => t[0] + t[1]); // [4, 6]
 * zipWith([[1, 2], [10]], (t) => t.reduce((a, b) => a + b, 0), { fillValue: 0 }); // [11, 2]
 */
export function zipWith<T extends readonly any[], R>(
  inputs: { [K in keyof T]: Iterable<T[K]> | { [key: string]: T[K] } },
  fn: (tuple: T[number][]) => R,
  options?: { fillValue?: T[number]; includeValues?: boolean },
): R[] {
  return zip(inputs, options).map(fn);
}

/**
 * Unzips an array of tuples back into separate arrays.
 * - Reverses the zip operation: transforms rows to columns.
 * - Useful for separating previously combined collections.
 * @param zipped Array of tuples (rows) to transpose
 * @returns Array of arrays (columns), one per tuple position
 * @example
 * const zipped = [[1, 'a'], [2, 'b'], [3, 'c']];
 * unzip(zipped); // [[1, 2, 3], ['a', 'b', 'c']]
 */
export function unzip<T>(zipped: T[][]): T[][] {
  if (zipped.length === 0) return [];
  const length = zipped[0]?.length ?? 0;
  const result: T[][] = Array.from({ length }, () => []);
  for (const tuple of zipped) {
    tuple.forEach((v, i) => result[i]?.push(v));
  }
  return result;
}
