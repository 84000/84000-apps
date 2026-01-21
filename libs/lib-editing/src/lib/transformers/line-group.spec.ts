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
  content: 'A group of verse lines',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 22,
      type: 'line-group',
      uuid: 'linegroup-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('lineGroup transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform lineGroup annotation correctly', () => {
    const lineGroupNode = recurseForType({
      until: 'lineGroup',
      block,
    });
    expect(lineGroupNode).toBeDefined();
    expect(lineGroupNode?.type).toBe('lineGroup');
    expect(lineGroupNode?.attrs?.uuid).toBe('linegroup-uuid-1');
    expect(lineGroupNode?.content).toBeDefined();
    expect(lineGroupNode?.content?.[0]?.type).toBe('line');
  });
});
