import type { AnnotationDTO } from './annotation-type';
import type { GlossaryInstanceAnnotation } from './annotation';
import { annotationFromDTO, annotationToDTO } from './transform';

const row = (content: AnnotationDTO['content']): AnnotationDTO => ({
  uuid: 'gi-1',
  passage_uuid: 'passage-1',
  type: 'glossary-instance',
  start: 0,
  end: 6,
  content,
});

describe('glossary instance content', () => {
  it.each([
    ['uuid only', [{ uuid: 'g1' }]],
    ['uuid and authority together', [{ uuid: 'g1', authority: 'a1' }]],
    ['uuid and authority apart', [{ uuid: 'g1' }, { authority: 'a1' }]],
    ['authority first', [{ authority: 'a1' }, { uuid: 'g1' }]],
  ])('reads the entry uuid from %s and ignores authority', (_, content) => {
    const annotation = annotationFromDTO(
      row(content),
      6,
    ) as GlossaryInstanceAnnotation;

    expect(annotation.type).toBe('glossaryInstance');
    expect(annotation.glossary).toBe('g1');
    expect(annotation).not.toHaveProperty('authority');
  });

  it.each([
    ['without authority', [{ uuid: 'g1' }]],
    ['with a stored authority', [{ uuid: 'g1' }, { authority: 'a1' }]],
  ])(
    'writes an instance read %s back as the entry uuid alone',
    (_, content) => {
      const dto = annotationToDTO(annotationFromDTO(row(content), 6));

      expect(dto).toMatchObject({
        uuid: 'gi-1',
        type: 'glossary-instance',
        start: 0,
        end: 6,
      });
      expect(dto?.content).toEqual([{ uuid: 'g1' }]);
    },
  );
});
