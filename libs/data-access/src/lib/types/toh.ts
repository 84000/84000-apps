export type TohokuCatalogEntry = `toh${number}`;

/** Split a comma-separated DB toh value (e.g. "toh417,toh418") into entries. */
export const parseTohList = (value?: string | null): TohokuCatalogEntry[] =>
  value
    ? (value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean) as TohokuCatalogEntry[])
    : [];

/** Join entries back into the DB comma-string form (undefined when empty). */
export const serializeTohList = (
  list?: TohokuCatalogEntry[],
): string | undefined => (list && list.length ? list.join(',') : undefined);
