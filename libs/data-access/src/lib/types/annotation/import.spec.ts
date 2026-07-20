import { annotationFromImport } from './import';
import type {
  HeadingAnnotation,
  LinkAnnotation,
  SpanAnnotation,
} from './annotation';

const base = { start: 0, end: 4, passageUuid: 'p1', passageText: 'Homage!' };

describe('annotationFromImport', () => {
  it('maps a simple kind to its domain type with a derived uuid', () => {
    const annotation = annotationFromImport('blockquote', base);
    expect(annotation).toMatchObject({
      type: 'blockquote',
      start: 0,
      end: 4,
      passageUuid: 'p1',
      uuid: 'p1:blockquote:0:4',
    });
  });

  it('maps the kebab "line-group" kind to the lineGroup type', () => {
    expect(annotationFromImport('line-group', base)?.type).toBe('lineGroup');
  });

  it('carries the text style onto a span', () => {
    const span = annotationFromImport('span', {
      ...base,
      data: { textStyle: 'emphasis' },
    }) as SpanAnnotation;
    expect(span.type).toBe('span');
    expect(span.textStyle).toBe('emphasis');
  });

  it('builds a link with its href and sliced text', () => {
    const link = annotationFromImport('link', {
      ...base,
      end: 6,
      passageText: 'Homage!',
      data: { href: 'https://84000.co' },
    }) as LinkAnnotation;
    expect(link.type).toBe('link');
    expect(link.href).toBe('https://84000.co');
    expect(link.text).toBe('Homage');
  });

  it('drops a link with no href', () => {
    expect(annotationFromImport('link', base)).toBeNull();
  });

  it('reads heading level and class, with sensible defaults', () => {
    const heading = annotationFromImport('heading', {
      ...base,
      data: { level: 2, class: 'section-title' },
    }) as HeadingAnnotation;
    expect(heading).toMatchObject({ type: 'heading', level: 2, class: 'section-title' });

    const fallback = annotationFromImport('heading', base) as HeadingAnnotation;
    expect(fallback.level).toBe(1);
    expect(fallback.class).toBe('section-title');
  });

  it('returns null for a kind with no importer', () => {
    expect(annotationFromImport('table', base)).toBeNull();
    expect(annotationFromImport('not-a-kind', base)).toBeNull();
  });
});
