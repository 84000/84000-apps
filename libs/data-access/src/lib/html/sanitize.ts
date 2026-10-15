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

/** Attributes the editor's inline marks carry. */
const MARK_ATTRIBUTES = ['data-type', 'data-text-style', 'data-lang', 'uuid'];

/** Attributes the editor's internal links and mentions carry. */
const ENTITY_LINK_ATTRIBUTES = [
  'entity',
  'entity-type',
  'data-toh',
  'data-same-work',
  'data-subtype',
  'data-link-toh',
];

/**
 * What a bibliography entry may hold: the editor's inline set.
 *
 * Paragraphs and line breaks, emphasis, underline, sub/superscript, small
 * caps, foreign text, links, internal links, mentions, glossary instances
 * and comment marks, each with the attributes the editor writes for it. A
 * mention carries its whole annotation in `data-items`, which its parse rule
 * reads back.
 */
export const BIBLIOGRAPHY_ALLOWLIST: HtmlAllowlist = {
  tags: ['p', 'br', 'strong', 'em', 'u', 'sub', 'sup', 'sm', 'span', 'a'],
  attributes: {
    strong: MARK_ATTRIBUTES,
    em: MARK_ATTRIBUTES,
    u: MARK_ATTRIBUTES,
    sub: MARK_ATTRIBUTES,
    sup: MARK_ATTRIBUTES,
    sm: ['class', ...MARK_ATTRIBUTES],
    span: [
      'class',
      'type',
      'data-type',
      'uuid',
      'lang',
      'textstyle',
      'data-text-style',
      'comment',
      'authority',
      'glossary',
      'data-items',
      'data-style',
      ...ENTITY_LINK_ATTRIBUTES,
    ],
    a: [
      'href',
      'target',
      'rel',
      'class',
      'type',
      'uuid',
      'lang',
      'data-style',
      'data-highlight-start',
      'data-highlight-end',
      ...ENTITY_LINK_ATTRIBUTES,
    ],
  },
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
 *
 * The result is trimmed unless `trim` is false, for a field whose stored
 * whitespace must survive an edit.
 */
export const sanitizeHtml = ({
  html,
  allowlist,
  trim = true,
}: {
  html: string;
  allowlist: HtmlAllowlist;
  trim?: boolean;
}): string => {
  const clean = sanitize(html, {
    allowedTags: allowlist.tags,
    allowedAttributes: allowlist.attributes,
    // The default drops these entirely, which is what we want: their content
    // is code, not text a person meant to write.
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
    disallowedTagsMode: 'discard',
  });
  return trim ? clean.trim() : clean;
};

/**
 * Whether a fragment says anything, once the markup is taken away.
 *
 * `<p></p>` is empty, and so is what is left of a fragment that held nothing
 * but disallowed markup — which is how a body that sanitizes away is refused
 * rather than stored blank.
 */
export const htmlHasText = (html: string): boolean =>
  sanitize(html, { allowedTags: [], allowedAttributes: {} }).trim().length > 0;
