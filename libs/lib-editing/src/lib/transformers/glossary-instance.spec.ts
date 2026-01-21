import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './recurse';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'The Buddha taught the Dharma.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 10,
      type: 'glossary-instance',
      uuid: 'glossary-instance-uuid-1',
      start: 4,
      content: [
        {
          uuid: 'glossary-entry-uuid-1',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('glossaryInstance transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform glossaryInstance annotation correctly', () => {
    // Transformers are applied automatically in blockFromPassage
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const glossaryMark = textNode?.marks?.find(
      (m: any) => m.type === 'glossaryInstance',
    );
    expect(glossaryMark).toBeDefined();
    expect(glossaryMark?.attrs?.glossary).toBe('glossary-entry-uuid-1');
    expect(glossaryMark?.attrs?.uuid).toBe('glossary-instance-uuid-1');
    expect(textNode?.text).toBe('Buddha');
  });
});
