/**
 * Text helpers for the glossary resolver. Pure.
 *
 * Stored passage content can hold soft hyphens and zero-width characters inside
 * a word, and a glossary name can too. Matching runs over the content with them
 * removed, and every position found there is mapped back to the stored offset,
 * which is the only coordinate a write accepts.
 */

/** Characters matching ignores: soft hyphen and the zero-width characters. */
const IGNORABLE = /[\u00ad\u200b-\u200d\u2060\ufeff]/g;
const IGNORABLE_CODES = new Set([0xad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff]);

/** Content as matching sees it, and where each of its positions sits in the stored content. */
export interface SearchableText {
  /** The stored content with ignorable characters removed. */
  text: string;
  /** `stored[i]` is the stored offset of `text[i]`; `stored[text.length]` is the stored length. */
  stored: number[];
}

export const searchableText = (content: string): SearchableText => {
  const stored: number[] = [];
  let text = '';
  for (let i = 0; i < content.length; i++) {
    if (IGNORABLE_CODES.has(content.charCodeAt(i))) continue;
    stored.push(i);
    text += content[i];
  }
  stored.push(content.length);
  return { text, stored };
};

/** The stored range covering `start`–`end` of the searchable text. */
export const storedRange = (
  searchable: SearchableText,
  start: number,
  end: number,
): { start: number; end: number } => ({
  start: searchable.stored[start],
  // The position after the last matched character, not the next character's
  // position: an ignorable character right after a match stays outside it.
  end: end > start ? searchable.stored[end - 1] + 1 : searchable.stored[start],
});

/** The searchable-text position of a stored offset (a removed character maps forward). */
export const searchablePosition = (
  searchable: SearchableText,
  storedOffset: number,
): number => {
  let lo = 0;
  let hi = searchable.stored.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (searchable.stored[mid] < storedOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/** A glossary name as matching sees it: no ignorable characters, single spaces, trimmed. */
export const normalizeForm = (name: string): string =>
  name.replace(IGNORABLE, '').replace(/\s+/g, ' ').trim();

/** One line of context: ignorable characters removed and line breaks spaced, as the work snapshot shows text. */
export const contextOf = (
  content: string,
  start: number,
  end: number,
  radius = 80,
): string => {
  const clean = (s: string) =>
    s.replace(IGNORABLE, '').replace(/[\r\n\t\v\f\u2028\u2029]/g, ' ');
  const before = clean(content.slice(Math.max(0, start - radius), start));
  const after = clean(content.slice(end, end + radius));
  return `${start > radius ? '…' : ''}${before}[[${clean(content.slice(start, end))}]]${after}${end + radius < content.length ? '…' : ''}`;
};

/**
 * A short, stable hash: two 32-bit FNV-1a passes with different seeds, as 16 hex
 * digits. Not cryptographic; it names a candidate, it does not protect one.
 */
export const stableHash = (value: string): string => {
  const pass = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return pass(0x811c9dc5) + pass(0x050c5d1f);
};

const FINGERPRINT_RADIUS = 24;

/**
 * A hash of the text around a stored range, ignoring case, whitespace runs and
 * ignorable characters. A decision made on a span records it, so an edit near
 * the span makes the decision stale instead of moving it.
 */
export const contextFingerprint = (
  content: string,
  start: number,
  end: number,
): string => {
  const clean = (s: string) =>
    s.replace(IGNORABLE, '').replace(/\s+/g, ' ').toLowerCase();
  const before = clean(
    content.slice(Math.max(0, start - FINGERPRINT_RADIUS * 2), start),
  );
  const after = clean(content.slice(end, end + FINGERPRINT_RADIUS * 2));
  return stableHash(
    `${before.slice(-FINGERPRINT_RADIUS)}|${clean(content.slice(start, end))}|${after.slice(0, FINGERPRINT_RADIUS)}`,
  );
};
