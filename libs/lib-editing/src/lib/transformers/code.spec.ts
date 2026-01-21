import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { code } from './code';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './util';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Some code text here',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 14,
      type: 'code',
      uuid: 'code-uuid-1',
      start: 5,
      content: [],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('code transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform code annotation correctly', () => {
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const codeMark = textNode?.marks?.find((m: any) => m.type === 'code');
    expect(codeMark).toBeDefined();
    expect(textNode?.text).toBe('code text');
  });
});
