/**
 * Snapshot text normalization. Two changes, nothing else (no case folding, no Unicode
 * normalization, no trimming):
 *
 * - soft hyphens (U+00AD) are removed, because they sit inside names and break grep;
 * - line breaks and tabs become one space each, so a value stays on one line and in one
 *   TSV cell. Tibetan folio text is the exception: its line breaks are folio layout, often
 *   inside a word, so they are dropped.
 */

export const SOFT_HYPHEN = '\u00AD';

const SOFT_HYPHENS = /\u00AD/g;
const BREAKS = /[\r\n\t\v\f\u2028\u2029]/g;

/** One physical line: soft hyphens removed, breaks and tabs replaced by spaces. */
export const normalizeText = (text: string | null | undefined): string =>
  (text ?? '').replace(SOFT_HYPHENS, '').replace(BREAKS, ' ');

/** Tibetan folio text on one line: folio line breaks dropped, not spaced. */
export const normalizeTibetan = (text: string | null | undefined): string =>
  normalizeText((text ?? '').replace(/\r?\n|\r/g, ''));

/**
 * Plain text from a stored HTML fragment (glossary definitions, bibliography entries),
 * mirroring the database's `strip_html`: tags dropped, the common entities decoded,
 * whitespace collapsed.
 */
export const htmlToText = (html: string | null | undefined): string =>
  normalizeText(
    (html ?? '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&'),
  )
    .replace(/\s+/g, ' ')
    .trim();

/** A TSV cell: normalized, so it cannot carry a tab or a line break. */
export const tsvCell = (value: string | number | null | undefined): string =>
  normalizeText(value === null || value === undefined ? '' : String(value));

export const tsvRow = (cells: (string | number | null | undefined)[]): string =>
  cells.map(tsvCell).join('\t');
