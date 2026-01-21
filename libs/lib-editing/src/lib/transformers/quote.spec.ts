import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

// The quote transformer is a no-op (pass), so we just verify it doesn't break
const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Some quoted text',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 16,
      type: 'quote',
      uuid: 'quote-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('quote transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should not transform quote annotation (pass-through)', () => {
    // quote is a pass-through transformer, so the block structure should remain unchanged
    expect(block).toBeDefined();
    expect(block.content).toBeDefined();
  });
});
