import type { Node } from '@tiptap/pm/model';
import { abbreviation } from './abbreviation';

describe('abbreviation exporter', () => {
  it('should export abbreviation annotation correctly', () => {
    const node = {
      attrs: {
        uuid: '49c41c6d-0e04-412e-81ad-22f3af377470',
        abbreviation: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
      },
      textContent: 'C',
    } as unknown as Node;

    const result = abbreviation({
      node,
      parent: node,
      root: node,
      start: 0,
      passageUuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
    });

    expect(result).toEqual({
      uuid: '49c41c6d-0e04-412e-81ad-22f3af377470',
      passageUuid: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
      type: 'abbreviation',
      start: 0,
      end: 1,
      abbreviation: 'e350ec6c-a40c-46bf-8182-acba5a50e4fe',
    });
  });
});
