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
  content: 'First line of verse.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 20,
      start: 0,
      type: 'line-group',
      uuid: 'line-group-uuid-1',
      passage_uuid: 'passage-uuid-1234',
      content: [],
    },
    {
      end: 20,
      type: 'line',
      uuid: 'line-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('line transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform line annotation correctly', () => {
    const lineNode = recurseForType({
      until: 'line',
      block,
    });
    expect(lineNode).toBeDefined();
    expect(lineNode?.type).toBe('line');
    expect(lineNode?.attrs?.uuid).toBe('line-uuid-1');
  });
});
