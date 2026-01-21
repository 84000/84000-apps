import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'This is a trailer section.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 26,
      type: 'trailer',
      uuid: 'trailer-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('trailer transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform trailer annotation correctly', () => {
    // The trailer should be in block.content[0]
    const trailerNode = block.content?.[0];
    expect(trailerNode).toBeDefined();
    expect(trailerNode?.type).toBe('trailer');
    expect(trailerNode?.attrs?.uuid).toBe('trailer-uuid-1');
  });
});
