import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { mantra } from './mantra';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './util';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'oṃ maṇi padme hūṃ',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 17,
      type: 'mantra',
      uuid: 'mantra-uuid-1',
      start: 0,
      content: [
        {
          lang: 'Sa-Ltn',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('mantra transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform mantra annotation correctly', () => {
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const mantraMark = textNode?.marks?.find((m: any) => m.type === 'mantra');
    expect(mantraMark).toBeDefined();
    expect(mantraMark?.attrs?.uuid).toBe('mantra-uuid-1');
    expect(mantraMark?.attrs?.lang).toBe('Sa-Ltn');
    expect(textNode?.text).toBe('oṃ maṇi padme hūṃ');
  });
});
