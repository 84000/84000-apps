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
  content: 'Some text',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 9,
      type: 'end-note-link',
      uuid: 'endnote-link-uuid-1',
      start: 9,
      content: [
        {
          uuid: 'endnote-uuid-1',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('endNoteLink transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform endNoteLink annotation correctly', () => {
    // Transformers are applied automatically in blockFromPassage
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const endnoteMark = textNode?.marks?.find(
      (m: any) => m.type === 'endNoteLink',
    );
    expect(endnoteMark).toBeDefined();
    expect(endnoteMark?.attrs?.notes).toBeDefined();
    expect(endnoteMark?.attrs?.notes?.length).toBe(1);
    expect(endnoteMark?.attrs?.notes?.[0].endNote).toBe('endnote-uuid-1');
    expect(endnoteMark?.attrs?.notes?.[0].uuid).toBe('endnote-link-uuid-1');
  });
});
