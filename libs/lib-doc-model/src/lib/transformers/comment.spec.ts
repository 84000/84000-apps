import {
  annotationsFromDTO,
  PassageDTO,
  passageFromDTO,
} from '@eightyfourthousand/data-access';
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
      type: 'comment',
      uuid: 'comment-annotation-uuid-1',
      start: 4,
      content: [
        {
          uuid: 'comment-thread-uuid-1',
        },
      ],
      passage_uuid: 'passage-uuid-1234',
    },
  ],
};

describe('comment transformer', () => {
  const passage = passageFromDTO(
    dto,
    annotationsFromDTO(dto.annotations || [], dto.content.length),
  );
  const block = blockFromPassage(passage);

  if (!block?.content) {
    throw new Error('Block conversion failed');
  }

  it('renders the anchor as a comment mark over the annotated range', () => {
    const textNode = findTextNodeWithMarks(block);
    expect(textNode?.type).toBe('text');
    expect(textNode?.text).toBe('Buddha');

    const commentMark = textNode?.marks?.find((m) => m.type === 'comment');
    expect(commentMark).toBeDefined();
    // The mark's own uuid is the anchor row; `comment` is the thread root.
    expect(commentMark?.attrs?.uuid).toBe('comment-annotation-uuid-1');
    expect(commentMark?.attrs?.comment).toBe('comment-thread-uuid-1');
  });

  it('drops an anchor with no thread uuid', () => {
    const consoleWarn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const orphanDto: PassageDTO = {
      ...dto,
      annotations: [{ ...(dto.annotations ?? [])[0], content: [] }],
    };
    const orphanBlock = blockFromPassage(
      passageFromDTO(
        orphanDto,
        annotationsFromDTO(
          orphanDto.annotations || [],
          orphanDto.content.length,
        ),
      ),
    );

    const textNode = findTextNodeWithMarks(orphanBlock!);
    expect(textNode?.marks?.some((m) => m.type === 'comment')).toBeFalsy();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });
});
