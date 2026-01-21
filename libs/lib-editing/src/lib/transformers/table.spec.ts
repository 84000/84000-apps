import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';
import { recurseForType } from './recurse';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Table content',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 13,
      type: 'table',
      uuid: 'table-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('table transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform table annotation correctly', () => {
    const tableNode = recurseForType({
      until: 'table',
      block,
    });
    expect(tableNode).toBeDefined();
    expect(tableNode?.type).toBe('table');
    expect(tableNode?.content).toBeDefined();
    expect(tableNode?.content?.[0]?.type).toBe('paragraph');
  });
});
