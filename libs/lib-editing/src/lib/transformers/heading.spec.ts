import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { heading } from './heading';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Chapter Title',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 13,
      type: 'heading',
      uuid: 'heading-uuid-1',
      start: 0,
      content: [
        {
          'heading-level': 'h2',
        },
        {
          'heading-type': 'chapter-title',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('heading transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform heading annotation correctly', () => {
    // The heading transformer should have already been applied during blockFromPassage
    // The annotation is applied to the paragraph block inside the passage block
    expect(block.content).toBeDefined();
    expect(block.content?.length).toBeGreaterThan(0);

    const paragraphBlock = block.content?.[0];
    expect(paragraphBlock).toBeDefined();
    expect(paragraphBlock?.type).toBe('heading');
    expect(paragraphBlock?.attrs).toBeDefined();
    expect(paragraphBlock?.attrs?.level).toBe(2);
    expect(paragraphBlock?.attrs?.class).toBe('chapter-title');
  });
});
