import {
  Annotation,
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@data-access';
import { internalLink } from './internal-link';
import { blockFromPassage } from '../block';
import { findTextNodeWithMarks } from './util';

const dto: PassageDTO = {
  sort: 1,
  type: 'root',
  uuid: 'passage-uuid-1234',
  label: '',
  xmlId: 'test-passage',
  parent: 'test-parent',
  content: 'See the glossary entry',
  work_uuid: 'work-uuid-5678',
  annotations: [
    {
      end: 22,
      type: 'internal-link',
      uuid: 'internal-link-uuid-1',
      start: 8,
      content: [
        {
          type: 'glossary',
        },
        {
          uuid: 'glossary-entity-uuid',
        },
        {
          href: '#glossary-entry',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('internalLink transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('should transform internalLink annotation correctly', () => {
    const textNode = findTextNodeWithMarks(block);
    expect(textNode).toBeDefined();
    expect(textNode?.type).toBe('text');
    expect(textNode?.marks).toBeDefined();
    const internalLinkMark = textNode?.marks?.find(
      (m: any) => m.type === 'internalLink',
    );
    expect(internalLinkMark).toBeDefined();
    expect(internalLinkMark?.attrs?.uuid).toBe('internal-link-uuid-1');
    expect(internalLinkMark?.attrs?.type).toBe('glossary');
    expect(internalLinkMark?.attrs?.entity).toBe('glossary-entity-uuid');
    expect(textNode?.text).toBe('glossary entry');
  });
});
