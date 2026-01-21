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
  content: 'This is the first paragraph.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 28,
      type: 'paragraph',
      uuid: 'paragraph-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('paragraph transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform paragraph annotation correctly', () => {
    const paragraphNode = recurseForType({
      until: 'paragraph',
      block,
    });
    expect(paragraphNode).toBeDefined();
    expect(paragraphNode?.type).toBe('paragraph');
    expect(paragraphNode?.attrs?.uuid).toBe('paragraph-uuid-1');
  });
});
