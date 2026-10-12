/** How many values one `in` filter carries: the list travels in the URL. */
export const IN_BATCH_SIZE = 200;

/** The values of an `in` filter, in batches small enough for the URL. */
export const inBatches = <T>(values: readonly T[]): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < values.length; i += IN_BATCH_SIZE) {
    batches.push(values.slice(i, i + IN_BATCH_SIZE));
  }
  return batches;
};
