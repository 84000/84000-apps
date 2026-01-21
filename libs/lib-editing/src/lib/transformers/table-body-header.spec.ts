import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Header cell',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 11,
      type: 'table-body-header',
      uuid: 'table-header-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('tableBodyHeader transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform tableBodyHeader annotation correctly', () => {
    // The tableHeader should be in block.content[0]
    const tableHeaderNode = block.content?.[0];
    expect(tableHeaderNode).toBeDefined();
    expect(tableHeaderNode?.type).toBe('tableHeader');
    expect(tableHeaderNode?.content).toBeDefined();
    expect(tableHeaderNode?.content?.[0]?.type).toBe('paragraph');
  });
});
