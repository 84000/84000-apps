import { annotationFromDTO, annotationToDTO } from './transform';
import type { AnnotationDTO } from './annotation-type';
import type { UnknownAnnotation } from './annotation';

const deprecatedReference: AnnotationDTO = {
  uuid: 'a1',
  start: 10,
  end: 19,
  type: 'deprecated-reference' as AnnotationDTO['type'],
  passage_uuid: 'p1',
  content: [{ title: '[B.2]' }],
};

describe('unknown annotations', () => {
  it('keeps the stored type and content on the domain annotation', () => {
    const annotation = annotationFromDTO(
      deprecatedReference,
      100,
    ) as UnknownAnnotation;

    expect(annotation.type).toBe('unknown');
    expect(annotation.dtoType).toBe('deprecated-reference');
    expect(annotation.dtoContent).toEqual([{ title: '[B.2]' }]);
  });

  it('round-trips a deprecated row back to the type and content it had', () => {
    const annotation = annotationFromDTO(deprecatedReference, 100);
    const dto = annotationToDTO(annotation);

    expect(dto).toMatchObject({
      uuid: 'a1',
      start: 10,
      end: 19,
      type: 'deprecated-reference',
      content: [{ title: '[B.2]' }],
    });
  });

  it('round-trips a deprecated mention without flattening its content', () => {
    const dto = annotationToDTO(
      annotationFromDTO(
        {
          ...deprecatedReference,
          type: 'deprecated-temp-mention' as AnnotationDTO['type'],
          content: [
            { toh: 'toh8' },
            { type: 'folio' },
            { uuid: 'f1' },
            { same_work: true },
          ],
        },
        100,
      ),
    );

    expect(dto?.type).toBe('deprecated-temp-mention');
    expect(dto?.content).toHaveLength(4);
  });

  it('still exports a genuinely unknown row as unknown', () => {
    const dto = annotationToDTO(
      annotationFromDTO({ ...deprecatedReference, type: 'unknown' }, 100),
    );

    expect(dto?.type).toBe('unknown');
  });
});
