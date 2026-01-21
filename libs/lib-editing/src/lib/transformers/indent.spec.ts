import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { indent } from './indent';
import { blockFromPassage } from '../block';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Indented paragraph text',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 23,
      type: 'indent',
      uuid: 'indent-uuid-1',
      start: 0,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('indent transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform indent annotation correctly', () => {
    // The indent annotation is applied to the paragraph block inside the passage block
    expect(block.content).toBeDefined();
    expect(block.content?.length).toBeGreaterThan(0);

    const paragraphBlock = block.content?.[0];
    expect(paragraphBlock).toBeDefined();
    expect(paragraphBlock?.attrs).toBeDefined();
    expect(paragraphBlock?.attrs?.hasIndent).toBe(true);
    expect(paragraphBlock?.attrs?.indentUuid).toBe('indent-uuid-1');
  });
});
