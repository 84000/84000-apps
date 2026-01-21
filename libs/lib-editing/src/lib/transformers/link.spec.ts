import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { link } from './link';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './recurse';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'Click here to learn more',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 10,
      type: 'link',
      uuid: 'link-uuid-1',
      start: 6,
      content: [
        {
          href: 'https://example.com',
        },
        {
          'link-text': 'here',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('link transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform link annotation correctly', () => {
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const linkMark = textNode?.marks?.find((m: any) => m.type === 'link');
    expect(linkMark).toBeDefined();
    expect(linkMark?.attrs?.uuid).toBe('link-uuid-1');
    expect(linkMark?.attrs?.href).toBe('https://example.com');
    expect(textNode?.text).toBe('here');
  });
});
