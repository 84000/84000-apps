import { IDENTITY_ATTRS } from '../annotation-attrs';

/**
 * Attributes that must not be carried onto a block split off from another.
 *
 * `uuid` and the parameter-annotation attributes hold annotation *identity*:
 * copying them would put one annotation's uuid on two nodes, which the save
 * path then upserts as a single row that steals the other's `passage_uuid`.
 * `hasParagraphIndent` is display-only but is reset alongside them so a split
 * paragraph does not inherit a conditional indent it was never given.
 */
const ATTRS_TO_IGNORE = [...IDENTITY_ATTRS, 'hasParagraphIndent'];

export const filterAttrs = (attrs: Record<string, unknown> | undefined) => {
  if (!attrs) {
    return attrs;
  }

  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !ATTRS_TO_IGNORE.includes(key)),
  );
};
