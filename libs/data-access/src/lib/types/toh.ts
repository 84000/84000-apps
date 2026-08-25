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

/**
 * Normalize however a person wrote a Tohoku number into the catalogued form.
 *
 * Accepts `Toh 312`, `toh312`, `TOH.312`, `T. 312` and a bare `312`, all of which
 * translators use interchangeably, and returns `toh312`. Returns `undefined` for
 * anything with no digits, or whose digits are not the whole remainder — so
 * `toh312a` is rejected rather than silently read as `toh312`, since a suffixed
 * number is a different catalogue entry and guessing which is not this
 * function's call.
 */
export const normalizeToh = (
  input?: string | null,
): TohokuCatalogEntry | undefined => {
  const digits = (input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^t(?:oh)?[\s.]*/, '')
    .trim();

  if (!/^\d+$/.test(digits)) {
    return undefined;
  }

  // Strip leading zeros so `toh0312` and `toh312` resolve alike.
  const number = Number.parseInt(digits, 10);
  return `toh${number}`;
};

/**
 * Whether `note` mentions `toh` as a standalone number.
 *
 * `work_toh.toh_note` records the alternate numbers a work is cited under, so a
 * substring test is how an alias is found — but a bare `ILIKE '%418%'` also
 * matches `1418` and `4180`, which are unrelated works. Requiring no adjacent
 * digit keeps the match to the number actually written.
 */
export const tohNoteMentions = (
  note: string | null | undefined,
  toh: TohokuCatalogEntry,
): boolean => {
  const digits = toh.replace(/^toh/, '');
  if (!note || !digits) {
    return false;
  }
  return new RegExp(`(?<!\\d)${digits}(?!\\d)`).test(note);
};
