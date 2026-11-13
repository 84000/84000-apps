import { stableStringify } from '../passage/save/diff';
import type { ExpectGuard } from './types';

/** Whether two values are equal as JSON, absent being `null`. */
export const same = (a: unknown, b: unknown) =>
  stableStringify(a ?? null) === stableStringify(b ?? null);

/**
 * The first field of `expect` whose value differs from `stored`, described
 * for an error message; undefined when every field matches. A missing row
 * matches nothing.
 */
export const expectMismatch = (
  what: string,
  stored: Record<string, unknown> | undefined,
  expect: ExpectGuard | undefined,
): string | undefined => {
  if (!expect) return undefined;
  for (const [field, expected] of Object.entries(expect)) {
    if (!stored) {
      return `${what}: expected ${field} to be ${JSON.stringify(expected)}, but there is no stored row`;
    }
    if (!(field in stored)) {
      return `${what}: ${field} cannot be checked with expect; it is not a stored field that was read`;
    }
    if (!same(stored[field], expected)) {
      return `${what}: expected ${field} to be ${JSON.stringify(expected)} but found ${JSON.stringify(stored[field] ?? null)}. Re-read before retrying.`;
    }
  }
  return undefined;
};
