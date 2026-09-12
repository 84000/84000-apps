import type { AnnotationDTO } from './annotation-type';
import {
  ANNOTATIONS_TO_IGNORE,
  DRAFT_ONLY_ANNOTATIONS,
} from './annotation-type';
import type { CommentAnnotation } from './annotation';
import { annotationFromDTO, annotationToDTO } from './transform';

const dto: AnnotationDTO = {
  uuid: 'comment-annotation-uuid-1',
  passage_uuid: 'passage-uuid-1',
  type: 'comment',
  start: 4,
  end: 10,
  content: [{ uuid: 'comment-thread-uuid-1' }],
};

describe('comment annotation', () => {
  it('reads the thread uuid off the DTO content', () => {
    const annotation = annotationFromDTO(dto, 29) as CommentAnnotation;

    expect(annotation.type).toBe('comment');
    expect(annotation.uuid).toBe('comment-annotation-uuid-1');
    expect(annotation.comment).toBe('comment-thread-uuid-1');
  });

  it('round-trips back to the DTO shape', () => {
    const annotation = annotationFromDTO(dto, 29);

    expect(annotationToDTO(annotation)).toMatchObject({
      uuid: 'comment-annotation-uuid-1',
      passage_uuid: 'passage-uuid-1',
      type: 'comment',
      start: 4,
      end: 10,
      content: [{ uuid: 'comment-thread-uuid-1' }],
    });
  });

  it('is draft-only, and stays out of the save and replace diffs', () => {
    expect(DRAFT_ONLY_ANNOTATIONS).toContain('comment');
    // ANNOTATIONS_TO_IGNORE also gates the save delete diff and the replace
    // reflow, so a comment anchor must not be listed there.
    expect(ANNOTATIONS_TO_IGNORE).not.toContain('comment');
  });
});
