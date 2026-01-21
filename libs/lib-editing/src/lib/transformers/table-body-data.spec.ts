import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Cell data',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 9,
      type: 'table-body-data',
      uuid: 'table-data-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('tableBodyData transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform tableBodyData annotation correctly', () => {
    // The tableCell should be in block.content[0]
    const tableCellNode = block.content?.[0];
    expect(tableCellNode).toBeDefined();
    expect(tableCellNode?.type).toBe('tableCell');
    expect(tableCellNode?.content).toBeDefined();
    expect(tableCellNode?.content?.[0]?.type).toBe('paragraph');
  });
});
