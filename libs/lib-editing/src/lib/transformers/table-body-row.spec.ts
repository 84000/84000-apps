import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Row data',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 8,
      type: 'table-body-row',
      uuid: 'table-row-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('tableBodyRow transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform tableBodyRow annotation correctly', () => {
    // The tableRow should be in block.content[0]
    const tableRowNode = block.content?.[0];
    expect(tableRowNode).toBeDefined();
    expect(tableRowNode?.type).toBe('tableRow');
    expect(tableRowNode?.content).toBeDefined();
    expect(tableRowNode?.content?.[0]?.type).toBe('paragraph');
  });
});
