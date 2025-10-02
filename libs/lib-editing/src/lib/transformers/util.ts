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
