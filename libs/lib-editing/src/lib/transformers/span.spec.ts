import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { span } from './span';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './recurse';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Some bold text here',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 14,
      type: 'span',
      uuid: 'span-uuid-1',
      start: 5,
      content: [
        {
          'text-style': 'text-bold',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('span transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform span annotation correctly', () => {
    const annotation = passage.annotations.find(
      (a: Annotation) => a.type === 'span',
    ) as Annotation;
    span({
      root: block,
      parent: block,
      block,
      annotation,
    });

    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const boldMark = textNode?.marks?.find((m: any) => m.type === 'bold');
    expect(boldMark).toBeDefined();
    expect(boldMark?.attrs?.uuid).toBe('span-uuid-1');
    expect(boldMark?.attrs?.textStyle).toBe('text-bold');
    expect(textNode?.text).toBe('bold text');
  });
});
