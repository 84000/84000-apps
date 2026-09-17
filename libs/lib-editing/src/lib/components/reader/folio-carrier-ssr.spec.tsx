import type { JSONContent } from '@tiptap/core';
import type { ReactElement } from 'react';
import type { Passage } from '@eightyfourthousand/data-access';
import { blockFromPassage } from '@eightyfourthousand/lib-doc-model';
import { TranslationSSRContent } from './TranslationSSRContent';

/**
 * The first folio reference renders above the first line of text. This is
 * authored in content rather than special-cased by the reader: the reference
 * sits on its own line, persisted as a zero-length `line` or `paragraph`
 * annotation, and the reader renders that text-empty block as its own block.
 *
 * The input is the real persisted shape, run through `blockFromPassage` as the
 * reader does, rather than hand-written editor JSON.
 */

type DangerousProps = {
  className?: string;
  dangerouslySetInnerHTML?: { __html: string };
  children?: string;
};

const renderedHtml = (element: ReactElement<DangerousProps>): string => {
  const html = element.props.dangerouslySetInnerHTML?.__html;
  if (typeof html !== 'string') {
    throw new Error('Expected dangerouslySetInnerHTML html string');
  }
  return html;
};

const render = (passage: Passage): string => {
  const block = blockFromPassage(passage) as JSONContent;
  const element = TranslationSSRContent({
    content: { type: 'doc', content: [block] },
  }) as ReactElement<DangerousProps>;
  return renderedHtml(element);
};

const folioMention = (uuid: string, text: string, at: number) => ({
  uuid,
  type: 'mention' as const,
  passageUuid: 'passage-1',
  validated: true,
  start: at,
  end: at,
  entity: `folio-${uuid}`,
  linkType: 'folio',
  text,
  isSameWork: true,
});

/** Toh 572's shape: a folio line ahead of a three-line lineGroup. */
const lineGroupPassage = (folioLine: boolean): Passage =>
  ({
    uuid: 'passage-1',
    type: 'translation',
    workUuid: 'work-1',
    sort: 1,
    label: '1.1',
    content: 'Homage to the Buddha, Homage to the Dharma.',
    annotations: [
      {
        uuid: 'group-1',
        type: 'lineGroup',
        passageUuid: 'passage-1',
        validated: true,
        start: 0,
        end: 42,
      },
      ...(folioLine
        ? [
            {
              uuid: 'line-folio',
              type: 'line' as const,
              passageUuid: 'passage-1',
              validated: true,
              start: 0,
              end: 0,
            },
          ]
        : []),
      {
        uuid: 'line-1',
        type: 'line',
        passageUuid: 'passage-1',
        validated: true,
        start: 0,
        end: 22,
      },
      {
        uuid: 'line-2',
        type: 'line',
        passageUuid: 'passage-1',
        validated: true,
        start: 22,
        end: 42,
      },
      folioMention('mention-1', '[F.147.a]', 0),
      folioMention('mention-2', '[F.199.a]', 0),
    ],
  }) as unknown as Passage;

/** Toh 209's shape: no line structure, just paragraphs. */
const paragraphPassage = (): Passage =>
  ({
    uuid: 'passage-1',
    type: 'translation',
    workUuid: 'work-1',
    sort: 1,
    label: '1.1',
    content: 'Homage to all buddhas and bodhisattvas!',
    annotations: [
      {
        uuid: 'para-folio',
        type: 'paragraph',
        passageUuid: 'passage-1',
        validated: true,
        start: 0,
        end: 0,
      },
      {
        uuid: 'para-text',
        type: 'paragraph',
        passageUuid: 'passage-1',
        validated: true,
        start: 0,
        end: 39,
      },
      folioMention('mention-1', '[F.111.b]', 0),
      folioMention('mention-2', '[F.112.a]', 0),
    ],
  }) as unknown as Passage;

describe('a folio reference on its own line, rendered by the reader', () => {
  it('renders the folio reference in its own line element, ahead of the text', () => {
    const html = render(lineGroupPassage(true));

    const folioLine = html.match(/<li[^>]*type="line"[^>]*>.*?<\/li>/s)?.[0];
    expect(folioLine).toBeDefined();
    expect(folioLine).toContain('[F.147.a]');
    expect(folioLine).toContain('[F.199.a]');
    // The folio line carries no text of the translation itself.
    expect(folioLine).not.toContain('Homage');

    // And it comes before the first line of text.
    expect(html.indexOf('[F.147.a]')).toBeLessThan(
      html.indexOf('Homage to the Buddha'),
    );
  });

  it('keeps the folio reference inline when no folio line is authored', () => {
    // The unchanged shape: without a zero-length line, the reference still
    // renders at the head of 1.1, as it does across the published library.
    const html = render(lineGroupPassage(false));

    const firstLine = html.match(/<li[^>]*type="line"[^>]*>.*?<\/li>/s)?.[0];
    expect(firstLine).toContain('[F.147.a]');
    expect(firstLine).toContain('Homage to the Buddha');
  });

  it('renders a folio paragraph ahead of the text paragraph', () => {
    const html = render(paragraphPassage());

    const folioParagraph = html.match(/<p[^>]*>.*?<\/p>/s)?.[0];
    expect(folioParagraph).toBeDefined();
    expect(folioParagraph).toContain('[F.111.b]');
    expect(folioParagraph).toContain('[F.112.a]');
    expect(folioParagraph).not.toContain('Homage');

    expect(html.indexOf('[F.111.b]')).toBeLessThan(
      html.indexOf('Homage to all buddhas'),
    );
  });

  it('renders the whole translation text exactly once', () => {
    const html = render(lineGroupPassage(true));

    expect(html.match(/Homage to the Buddha/g)).toHaveLength(1);
    expect(html.match(/Homage to the Dharma/g)).toHaveLength(1);
  });
});
