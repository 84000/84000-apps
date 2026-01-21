import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'This is a quoted text from scripture.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 37,
      type: 'blockquote',
      uuid: 'blockquote-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('blockquote transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform blockquote annotation correctly', () => {
    // The blockquote should be in block.content[0]
    const blockquoteNode = block.content?.[0];
    expect(blockquoteNode).toBeDefined();
    expect(blockquoteNode?.type).toBe('blockquote');
    expect(blockquoteNode?.attrs?.uuid).toBe('blockquote-uuid-1');
    expect(blockquoteNode?.content).toBeDefined();
    expect(blockquoteNode?.content?.[0]?.type).toBe('paragraph');
  });
});
