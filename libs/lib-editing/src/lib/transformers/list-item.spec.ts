import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Item in the list',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 16,
      type: 'list-item',
      uuid: 'listitem-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('listItem transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform listItem annotation correctly', () => {
    // The listItem should be in block.content[0]
    const listItemNode = block.content?.[0];
    expect(listItemNode).toBeDefined();
    expect(listItemNode?.type).toBe('listItem');
    expect(listItemNode?.attrs?.uuid).toBe('listitem-uuid-1');
    expect(listItemNode?.content).toBeDefined();
    expect(listItemNode?.content?.[0]?.type).toBe('paragraph');
  });
});
