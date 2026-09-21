/**
 * Escapes a value for an attribute selector.
 *
 * An attribute selector takes a quoted string, so only quotes and backslashes
 * need escaping — and `CSS.escape`, which quotes an identifier instead, is not
 * available everywhere this runs.
 */
export const attributeValue = (value: string) =>
  value.replace(/["\\]/g, '\\$&');

/** Every rendered anchor of one comment thread, live editor or static row. */
export const anchorSelector = (commentUuid: string) =>
  `span[type="comment"][comment="${attributeValue(commentUuid)}"]`;
