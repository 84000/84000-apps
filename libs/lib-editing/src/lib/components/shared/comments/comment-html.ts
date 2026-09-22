const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c]);

const UNESCAPES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
};

/**
 * What a person typed, as the fragment a comment is stored as.
 *
 * A blank line starts a paragraph and a single newline is a break, which is
 * what a textarea can express. Everything else is escaped: the composer sends
 * no markup it was not asked for, and a `<` someone typed stays a `<`.
 *
 * The write path sanitizes this again. That is not redundant — this is one
 * client, and the stored value has to be safe whoever wrote it.
 */
export const commentHtmlFromText = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escape(block).replace(/\n/g, '<br />')}</p>`)
    .join('');

/**
 * The fragment back as text, for editing it.
 *
 * Reverses `commentHtmlFromText` exactly, and knows the whole of what a comment
 * may hold: paragraphs, breaks, and the escapes written above. Widen the
 * allowlist and this widens with it.
 *
 * Deliberately not `innerHTML` on a scratch element. That needs a document,
 * which leaves the server with a fallback to pick, and every fallback is bad:
 * returning the fragment puts markup in the textarea, and the next save escapes
 * it into the body for good.
 *
 * Unescaping comes last, so an escaped `&lt;br /&gt;` someone typed stays text
 * rather than becoming a line break.
 */
export const commentTextFromHtml = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '')
    .replace(/&(amp|lt|gt|quot);/g, (entity) => UNESCAPES[entity])
    .trim();
