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
 * Normalize however a person wrote a Tohoku number into its catalogued form.
 *
 * Accepts `Toh 312`, `toh312`, `TOH.312`, `T. 312` and a bare `312`, which
 * translators use interchangeably. It also accepts the two suffixed forms the
 * catalogue actually uses — `toh1-1` (a numbered subdivision) and `toh1059a` (a
 * lettered one), which together account for 123 of production's 4,577 entries.
 * An earlier version required the remainder to be digits only, which reported
 * every one of those real entries as not existing.
 *
 * A lettered form is kept even where it is not itself an entry: `toh539a` is not
 * catalogued, but `toh539`'s note records that it covers `toh539a–d`, so the
 * suffix is what lets the note resolve it. Leading zeros are stripped from each
 * numeric group so `toh0312` and `toh312` agree.
 *
 * Returns `undefined` when nothing digit-led remains, or when the remainder is
 * neither of those forms — a range like `539a-d` is a citation of several works,
 * not of one, so it is not a number this can normalize.
 */
export const normalizeToh = (
  input?: string | null,
): TohokuCatalogEntry | undefined => {
  const remainder = (input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^t(?:oh)?[\s.]*/, '')
    .trim();

  const match = /^(\d+)(?:-(\d+)|([a-z]))?$/.exec(remainder);
  if (!match) {
    return undefined;
  }

  const [, main, subdivision, letter] = match;
  const base = Number.parseInt(main, 10);

  if (subdivision !== undefined) {
    return `toh${base}-${Number.parseInt(subdivision, 10)}` as TohokuCatalogEntry;
  }

  // The template literal type describes the plain form; the catalogue's suffixed
  // entries are read out of the database with the same cast everywhere else.
  return `toh${base}${letter ?? ''}` as TohokuCatalogEntry;
};

/** The `1069` and `1073` of a note reading "Toh 1069-1073", either dash. */
const NUMERIC_RANGE = /(\d+)\s*[-–—]\s*(\d+)/g;

/** The `539`, `a` and `d` of a note reading "toh539a–d", either dash. */
const LETTER_RANGE = /(\d+)\s*([a-z])\s*[-–—]\s*([a-z])/g;

/**
 * Whether `note` names `toh`.
 *
 * `work_toh.toh_note` records the numbers an entry covers beyond its own label,
 * and every note in production is one of three shapes: a bare alternate number
 * (`toh417` notes `toh418`), a numeric range (`toh1069` notes `Toh 1069-1073`),
 * or a lettered range (`toh539` notes `toh539a–d`). The ranges are what make
 * this more than a substring test: `toh1071` is covered by the first but the
 * string "1071" appears nowhere in it, and `toh539c` by the second.
 *
 * Both ranges were confirmed to mean coverage rather than subdivision, by
 * checking that `toh1070`–`toh1073` and `toh539a`–`toh539d` are absent from
 * `work_toh` while `toh539e` and `toh539f` are present as entries of their own.
 *
 * A bare mention still requires no adjacent digit, so a note reading `Toh 1418`
 * does not answer for `toh418`.
 */
export const tohNoteMentions = (
  note: string | null | undefined,
  toh: TohokuCatalogEntry,
): boolean => {
  const remainder = String(toh).replace(/^toh/, '');
  if (!note || !remainder) {
    return false;
  }

  const cited = /^(\d+)([a-z])?$/.exec(remainder);

  if (cited) {
    const [, main, letter] = cited;
    const number = Number.parseInt(main, 10);

    if (letter) {
      for (const [, base, from, to] of note
        .toLowerCase()
        .matchAll(LETTER_RANGE)) {
        if (
          Number.parseInt(base, 10) === number &&
          letter >= from &&
          letter <= to
        ) {
          return true;
        }
      }
    } else {
      for (const [, from, to] of note.matchAll(NUMERIC_RANGE)) {
        const lo = Number.parseInt(from, 10);
        const hi = Number.parseInt(to, 10);
        // Require a widening range: "toh1-1" is a subdivision label, not a span.
        if (hi > lo && number >= lo && number <= hi) {
          return true;
        }
      }
    }
  }

  // Escape the remainder: the subdivision form contains a regex metacharacter.
  const literal = remainder.replace(/[-]/g, '\\$&');
  // Reject a neighbouring letter, digit or hyphen, all of which make the number
  // part of a longer entry label: a note reading `toh1-1` names that subdivision
  // rather than `toh1` — on either side of the hyphen — and `toh418a` is not
  // `toh418`.
  return new RegExp(`(?<![\\d-])${literal}(?![\\da-z]|-\\d)`).test(
    note.toLowerCase(),
  );
};
