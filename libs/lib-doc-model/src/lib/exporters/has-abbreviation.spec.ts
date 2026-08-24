import type { Node } from '@tiptap/pm/model';
import { hasAbbreviation } from './has-abbreviation';

describe('hasAbbreviation exporter', () => {
  it('should export hasAbbreviation annotation correctly', () => {
    const node = {
      attrs: {
        uuid: 'has-abbr-uuid-1234',
        abbreviation: 'abbr-ref-uuid-5678',
      },
      textContent: 'Toh',
    } as unknown as Node;

    const result = hasAbbreviation({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'passage-uuid-1234',
    });

    expect(result).toEqual({
      uuid: 'has-abbr-uuid-1234',
      passageUuid: 'passage-uuid-1234',
      type: 'hasAbbreviation',
      start: 0,
      end: 3,
      abbreviation: 'abbr-ref-uuid-5678',
    });
  });
});
