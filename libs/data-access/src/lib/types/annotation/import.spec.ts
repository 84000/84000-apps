import { annotationFromImport } from './import';
import type {
  EndNoteLinkAnnotation,
  GlossaryInstanceAnnotation,
  HeadingAnnotation,
  InlineTitleAnnotation,
  LinkAnnotation,
  MantraAnnotation,
  MentionAnnotation,
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

  it('keeps an existing uuid instead of deriving one', () => {
    const existing = annotationFromImport('blockquote', {
      ...base,
      uuid: 'ann-1',
    });
    expect(existing?.uuid).toBe('ann-1');
  });

  it('builds a folio mention as a zero-length annotation', () => {
    const mention = annotationFromImport('mention', {
      ...base,
      start: 196,
      end: 196,
      data: {
        entity: 'folio-uuid',
        linkType: 'folio',
        isSameWork: true,
        linkToh: 'toh58',
      },
    }) as MentionAnnotation;
    expect(mention).toMatchObject({
      type: 'mention',
      start: 196,
      end: 196,
      entity: 'folio-uuid',
      linkType: 'folio',
      isSameWork: true,
      linkToh: 'toh58',
    });
  });

  it('carries a mention highlight range, which targets the linked passage', () => {
    const mention = annotationFromImport('mention', {
      ...base,
      data: {
        entity: 'passage-uuid',
        linkType: 'passage',
        highlightStart: 10,
        highlightEnd: 20,
      },
    }) as MentionAnnotation;
    expect(mention.highlightStart).toBe(10);
    expect(mention.highlightEnd).toBe(20);
  });

  it('drops a mention with no entity or no link type', () => {
    expect(
      annotationFromImport('mention', { ...base, data: { linkType: 'folio' } }),
    ).toBeNull();
    expect(
      annotationFromImport('mention', { ...base, data: { entity: 'e1' } }),
    ).toBeNull();
  });

  it('builds a glossary instance from both of its identifiers', () => {
    const instance = annotationFromImport('glossary-instance', {
      ...base,
      data: { glossary: 'g1', authority: 'a1' },
    }) as GlossaryInstanceAnnotation;
    expect(instance).toMatchObject({
      type: 'glossaryInstance',
      glossary: 'g1',
      authority: 'a1',
    });
  });

  it('drops a glossary instance missing either identifier', () => {
    expect(
      annotationFromImport('glossary-instance', {
        ...base,
        data: { glossary: 'g1' },
      }),
    ).toBeNull();
  });

  it('builds an end note link with its label', () => {
    const link = annotationFromImport('end-note-link', {
      ...base,
      data: { endNote: 'note-1', label: '17' },
    }) as EndNoteLinkAnnotation;
    expect(link).toMatchObject({
      type: 'endNoteLink',
      endNote: 'note-1',
      label: '17',
    });
  });

  it('drops an end note link with no note', () => {
    expect(annotationFromImport('end-note-link', base)).toBeNull();
  });

  it('builds an inline title from its language', () => {
    const title = annotationFromImport('inline-title', {
      ...base,
      data: { lang: 'Sa-Ltn' },
    }) as InlineTitleAnnotation;
    expect(title).toMatchObject({ type: 'inlineTitle', lang: 'Sa-Ltn' });
  });

  it('drops an inline title with no language', () => {
    expect(annotationFromImport('inline-title', base)).toBeNull();
  });

  it('builds a mantra, whose language is optional', () => {
    const withLang = annotationFromImport('mantra', {
      ...base,
      data: { lang: 'Sa-Ltn' },
    }) as MantraAnnotation;
    expect(withLang).toMatchObject({ type: 'mantra', lang: 'Sa-Ltn' });
    expect(annotationFromImport('mantra', base)?.type).toBe('mantra');
  });

  it('builds the annotations that carry nothing but a range', () => {
    expect(annotationFromImport('trailer', base)?.type).toBe('trailer');
    expect(annotationFromImport('leading-space', base)?.type).toBe(
      'leadingSpace',
    );
  });
});
