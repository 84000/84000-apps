import {
  contentUuid,
  hasXmlIdKeys,
  isDeprecatedType,
  isOrphanedByStrip,
  stripXmlIds,
} from './sanitize';

// Shapes below are taken from production rows: content is an ARRAY of objects, and
// entries carry either several keys or exactly one.
const glossaryInstance = [
  {
    type: 'glossary',
    uuid: '3ff9b08a-e442-458e-8095-63f34764be81',
    glossary_xmlId: 'UT22084-051-001-3225',
  },
  { authority: '41b299ff-7692-40b4-bbb3-b6a64c9ffb73' },
];

const abbreviationWithoutUuid = [
  { abbreviation_xmlId: 'UT22084-001-006-7428/abbreviation' },
];

describe('stripXmlIds', () => {
  it('removes *_xmlId keys but keeps everything else', () => {
    expect(stripXmlIds(glossaryInstance)).toEqual([
      { type: 'glossary', uuid: '3ff9b08a-e442-458e-8095-63f34764be81' },
      { authority: '41b299ff-7692-40b4-bbb3-b6a64c9ffb73' },
    ]);
  });

  it('drops entries that become empty rather than leaving {}', () => {
    expect(stripXmlIds([{ uuid: 'a' }, { endnote_xmlId: 'x' }])).toEqual([
      { uuid: 'a' },
    ]);
  });

  it('leaves content with no xmlIds untouched', () => {
    const content = [{ 'text-style': 'foreign' }, { lang: 'Bo-Ltn' }];
    expect(stripXmlIds(content)).toEqual(content);
  });

  it('handles the empty content that structural annotations carry', () => {
    expect(stripXmlIds([])).toEqual([]);
  });

  it('preserves the order of surviving entries', () => {
    const content = [{ a: 1 }, { x_xmlId: 'v' }, { b: 2 }];
    expect(stripXmlIds(content)).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe('hasXmlIdKeys', () => {
  it('detects a key nested anywhere in the array', () => {
    expect(hasXmlIdKeys(glossaryInstance)).toBe(true);
  });

  it('is false for content with no xmlIds', () => {
    expect(hasXmlIdKeys([{ uuid: 'a' }])).toBe(false);
  });

  it('does not match a key merely containing the substring', () => {
    expect(hasXmlIdKeys([{ xmlIdentifier: 'a' }])).toBe(false);
  });
});

describe('isOrphanedByStrip', () => {
  it('flags an annotation whose only reference is an xmlId', () => {
    expect(isOrphanedByStrip(abbreviationWithoutUuid)).toBe(true);
  });

  it('does not flag one that also has a uuid', () => {
    expect(isOrphanedByStrip(glossaryInstance)).toBe(false);
  });

  it('does not flag structural annotations that never had content', () => {
    expect(isOrphanedByStrip([])).toBe(false);
  });

  it('does not flag styling annotations with no reference', () => {
    expect(isOrphanedByStrip([{ 'text-style': 'foreign' }])).toBe(false);
  });
});

describe('contentUuid', () => {
  it('finds a uuid in a multi-key entry', () => {
    expect(contentUuid(glossaryInstance)).toBe(
      '3ff9b08a-e442-458e-8095-63f34764be81',
    );
  });

  it('finds a uuid in a later entry', () => {
    expect(contentUuid([{ type: 'passage' }, { uuid: 'abc' }])).toBe('abc');
  });

  it('returns null when absent', () => {
    expect(contentUuid(abbreviationWithoutUuid)).toBeNull();
  });
});

describe('isDeprecatedType', () => {
  it('matches the types the reader already filters', () => {
    expect(isDeprecatedType('deprecated-internal-link')).toBe(true);
    expect(isDeprecatedType('deprecated-reference')).toBe(true);
  });

  it('does not match live types', () => {
    expect(isDeprecatedType('glossary-instance')).toBe(false);
    // Named to look deprecated but is not prefixed, so it stays published.
    expect(isDeprecatedType('temp-deprecate-mention')).toBe(false);
  });
});
