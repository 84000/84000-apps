import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { inlineTitle } from './inline-title';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './util';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'The Dhammapada is a collection of sayings',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 14,
      type: 'inline-title',
      uuid: 'inline-title-uuid-1',
      start: 4,
      content: [
        {
          lang: 'Sa-Ltn',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('inlineTitle transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform inlineTitle annotation correctly', () => {
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const italicMark = textNode?.marks?.find((m: any) => m.type === 'italic');
    expect(italicMark).toBeDefined();
    expect(italicMark?.attrs?.uuid).toBe('inline-title-uuid-1');
    expect(italicMark?.attrs?.lang).toBe('Sa-Ltn');
    expect(italicMark?.attrs?.type).toBe('inlineTitle');
    expect(textNode?.text).toBe('Dhammapada');
  });
});
