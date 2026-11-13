/** Small helpers the glossary save planner shares. */

/**
 * A stored value `readStored` guarantees: it refuses reads that disagree, so
 * a missing one is a bug, not a concurrent change.
 */
export const must = <K, V>(map: ReadonlyMap<K, V>, key: K): V => {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`The stored state has nothing for ${String(key)}`);
  }
  return value;
};

/** `row`'s values of `keys`. */
export const pick = <T extends object, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Pick<T, K> => {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = row[key];
  return out;
};
