import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'The 84000 project translates Tibetan texts.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 10,
      type: 'has-abbreviation',
      uuid: 'has-abbr-uuid-1',
      start: 4,
      content: [
        {
          uuid: 'abbr-uuid-1',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('hasAbbreviation transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform hasAbbreviation annotation correctly', () => {
    // Find the hasAbbreviation node
    const findHasAbbreviationNode = (node: any): any => {
      if (node.type === 'hasAbbreviation') {
        return node;
      }
      if (node.content) {
        for (const child of node.content) {
          const found = findHasAbbreviationNode(child);
          if (found) return found;
        }
      }
      return null;
    };

    const hasAbbrNode = findHasAbbreviationNode(block);
    expect(hasAbbrNode).toBeDefined();
    expect(hasAbbrNode?.type).toBe('hasAbbreviation');
    expect(hasAbbrNode?.attrs?.abbreviation).toBe('abbr-uuid-1');
    expect(hasAbbrNode?.attrs?.uuid).toBe('has-abbr-uuid-1');
    expect(hasAbbrNode?.content?.[0]?.type).toBe('text');
    expect(hasAbbrNode?.content?.[0]?.text).toBe('84000 ');
  });
});
