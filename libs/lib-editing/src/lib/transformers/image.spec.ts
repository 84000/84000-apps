import { annotationsFromDTO, PassageDTO, passageFromDTO } from '@data-access';
import { blockFromPassage } from '../block';
import { recurseForType } from './recurse';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'See the diagram below.',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 3,
      type: 'image',
      uuid: 'image-uuid-1',
      start: 3,
      content: [
        {
          src: 'https://example.com/image.jpg',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('image transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform image annotation correctly', () => {
    const imageNode = recurseForType({
      until: 'image',
      block,
    });
    expect(imageNode).toBeDefined();
    expect(imageNode?.type).toBe('image');
    expect(imageNode?.attrs?.src).toBe('https://example.com/image.jpg');
    expect(imageNode?.attrs?.uuid).toBe('image-uuid-1');
  });
});
