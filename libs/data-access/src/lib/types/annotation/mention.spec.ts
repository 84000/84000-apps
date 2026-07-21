import { annotationFromDTO, annotationToDTO } from './transform';
import type { AnnotationDTO } from './annotation-type';
import type { MentionAnnotation } from './annotation';

describe('mention highlight range', () => {
  const baseDto: AnnotationDTO = {
    uuid: 'mention-1',
    start: 4,
    end: 4,
    type: 'mention',
    passage_uuid: 'passage-1',
    content: [
      { uuid: 'entity-1' },
      { type: 'passage' },
      { same_work: true },
      { start: 0 },
      { end: 248 },
    ],
  };

  it('parses `start`/`end` content pairs into highlightStart/highlightEnd', () => {
    const mention = annotationFromDTO(baseDto, 100) as MentionAnnotation;
    expect(mention.highlightStart).toBe(0);
    expect(mention.highlightEnd).toBe(248);
    // The annotation's own span is untouched by the content highlight range.
    expect(mention.start).toBe(4);
    expect(mention.end).toBe(4);
  });

  it('round-trips the highlight range back into content', () => {
    const mention = annotationFromDTO(baseDto, 100);
    const dto = annotationToDTO(mention);
    expect(dto?.content).toEqual(
      expect.arrayContaining([{ start: 0 }, { end: 248 }]),
    );
  });

  it('omits the highlight range when no `start`/`end` content is present', () => {
    const mention = annotationFromDTO(
      { ...baseDto, content: [{ uuid: 'entity-1' }, { type: 'passage' }] },
      100,
    ) as MentionAnnotation;
    expect(mention.highlightStart).toBeUndefined();
    expect(mention.highlightEnd).toBeUndefined();

    const dto = annotationToDTO(mention);
    expect(dto?.content).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ start: expect.anything() }),
      ]),
    );
  });
});
