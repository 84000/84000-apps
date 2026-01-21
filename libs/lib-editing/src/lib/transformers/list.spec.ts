import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'First item in list',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 18,
      type: 'list',
      uuid: 'list-uuid-1',
      start: 0,
      content: [
        {
          nesting: '0',
        },
        {
          'list-spacing': 'compact',
        },
        {
          'list-item-style': 'bullet',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('list transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform list annotation correctly', () => {
    // The list should be in block.content[0] and become a bulletList
    const listNode = block.content?.[0];
    expect(listNode).toBeDefined();
    expect(listNode?.type).toBe('bulletList');
    expect(listNode?.attrs?.uuid).toBe('list-uuid-1');
    expect(listNode?.attrs?.nesting).toBe(0);
    expect(listNode?.attrs?.spacing).toBe('compact');
    expect(listNode?.attrs?.itemStyle).toBe('bullet');
    expect(listNode?.content).toBeDefined();
    expect(listNode?.content?.[0]?.type).toBe('paragraph');
  });
});
