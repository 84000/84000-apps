/** Plain text of a definition, as the glossary view compares them. */
const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Port of the database's `format_attestation(text, true)`. */
export const formatAttestation = (text: string | null): string | null => {
  if (text == null || !text.trim()) return null;
  const v = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/([\p{Ll}\p{Nd}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/\s+([,;:.)\]}])/g, '$1')
    .replace(/([,;:])([^\s)\]}])/g, '$1 $2')
    .replace(/\s*[-–—]+\s*/g, ' – ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
  // initcap: first letter of each alphanumeric run upper, the rest lower.
  return v
    .toLowerCase()
    .replace(
      /(^|[^\p{L}\p{N}])(\p{L})/gu,
      (_, before, letter) => before + letter.toUpperCase(),
    );
};

const STANDARD_RENDS = new Set([
  'appendWithStandard',
  'prependWithStandard',
  'bothWithStandard',
]);

/** The definition the view shows, combining the work's and the authority's. */
export const termDefinition = (
  glossaryDefinition: string | null,
  standardDefinition: string | null,
  rend: string | null,
): string => {
  if (rend === 'overrideWithStandard') return standardDefinition ?? '';
  if (rend && STANDARD_RENDS.has(rend)) {
    const standard = (standardDefinition ?? '').trim();
    if (
      standard &&
      stripHtml((glossaryDefinition ?? '').trim()).includes(stripHtml(standard))
    ) {
      return glossaryDefinition ?? '';
    }
    // SQL concatenation with a null operand is null, which the view coalesces to ''.
    if (glossaryDefinition == null || standardDefinition == null) return '';
    return rend === 'appendWithStandard'
      ? `${glossaryDefinition} ${standardDefinition}`
      : `${standardDefinition} ${glossaryDefinition}`;
  }
  return glossaryDefinition ?? '';
};
