const ATTRS_TO_IGNORE = [
  'hasLeadingSpace',
  'leadingSpaceUuid',
  'hasIndent',
  'indentUuid',
  'hasTrailingSpace',
  'trailingSpaceUuid',
  'hasParagraphIndent',
  'uuid',
];

export const filterAttrs = (attrs: Record<string, unknown> | undefined) => {
  if (!attrs) {
    return attrs;
  }

  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !ATTRS_TO_IGNORE.includes(key)),
  );
};

/**
 * Recursively searches a node tree to find the first text node that has marks applied.
 * Used in tests to verify that mark transformers (span, code, link, etc.) are working correctly.
 */
export const findTextNodeWithMarks = (node: any): any => {
  if (node.type === 'text' && node.marks && node.marks.length > 0) {
    return node;
  }
  if (node.content) {
    for (const child of node.content) {
      const found = findTextNodeWithMarks(child);
      if (found) return found;
    }
  }
  return null;
};
