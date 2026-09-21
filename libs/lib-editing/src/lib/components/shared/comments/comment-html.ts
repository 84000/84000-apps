const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ESCAPES[c]);

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
 * Lossless only because a comment holds nothing a textarea cannot show — see
 * the comment allowlist. Anything richer has to arrive with an editing surface
 * that can show it, or editing would quietly flatten it.
 */
export const commentTextFromHtml = (html: string): string => {
  if (typeof document === 'undefined') return html;

  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');

  const el = document.createElement('div');
  el.innerHTML = withBreaks;
  return (el.textContent ?? '').trim();
};
