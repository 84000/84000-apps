import sanitize from 'sanitize-html';

/**
 * What one field is allowed to hold.
 *
 * Per field rather than one global set: a comment is a few sentences of prose,
 * while a glossary definition carries markup inherited from TEI. Widening one
 * should not widen the others.
 */
export interface HtmlAllowlist {
  /** Element names kept. Anything else is unwrapped, keeping its text. */
  tags: string[];
  /** Attributes kept, by tag name. Anything else is dropped. */
  attributes: Record<string, string[]>;
}

/**
 * What a comment body may hold.
 *
 * Paragraphs and line breaks only, which is exactly what the composer's
 * textarea can express. Emphasis would be dropped silently the first time
 * anyone edited a comment, because the composer shows a comment as text and
 * rebuilds it on save — so widen this and the composer together, not apart.
 */
export const COMMENT_ALLOWLIST: HtmlAllowlist = {
  tags: ['p', 'br'],
  attributes: {},
};

/**
 * Reduces an HTML fragment to what its field allows.
 *
 * Runs on the way in rather than on the way out, so a stored value is already
 * safe and every reader can render it without deciding for itself. That
 * matters here because the readers are not all the same program: the studio
 * renders a comment, and the MCP server reads the same rows.
 *
 * Disallowed elements are unwrapped rather than deleted, so removing markup
 * never silently removes what someone wrote. `script` and `style` are the
 * exception — their content is not prose.
 */
export const sanitizeHtml = ({
  html,
  allowlist,
}: {
  html: string;
  allowlist: HtmlAllowlist;
}): string =>
  sanitize(html, {
    allowedTags: allowlist.tags,
    allowedAttributes: allowlist.attributes,
    // The default drops these entirely, which is what we want: their content
    // is code, not text a person meant to write.
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
    disallowedTagsMode: 'discard',
  }).trim();

/**
 * Whether a fragment says anything, once the markup is taken away.
 *
 * `<p></p>` is empty, and so is what is left of a fragment that held nothing
 * but disallowed markup — which is how a body that sanitizes away is refused
 * rather than stored blank.
 */
export const htmlHasText = (html: string): boolean =>
  sanitize(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .trim().length > 0;
