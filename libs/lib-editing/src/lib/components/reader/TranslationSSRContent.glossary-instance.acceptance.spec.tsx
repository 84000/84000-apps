/**
 * Acceptance tests for DEV-907, glossary instances in reader output, written
 * from TASK.md alone. Each test names the criterion it covers:
 *
 *  AC4  an instance with no `authority` appears in reader output, the same as
 *       one that has it
 *  AC5  an old instance that still carries `authority` renders as before; the
 *       stored value is ignored
 *  AC7  readers unchanged. Publishing itself copies stored rows and needs the
 *       database, so this checks the reader-facing half: the output for an
 *       instance is the same with and without a stored authority.
 */
import type { JSONContent } from '@tiptap/core';
import type { ReactElement } from 'react';
import {
  annotationsFromDTO,
  passageFromDTO,
  type PassageDTO,
} from '@eightyfourthousand/data-access';
import { blockFromPassage } from '@eightyfourthousand/lib-doc-model';
import { TranslationSSRContent } from './TranslationSSRContent';

type DangerousProps = { dangerouslySetInnerHTML?: { __html: string } };

const GLOSSARY = 'a1a1a1a1-0000-4000-8000-000000000001';
const AUTHORITY = 'b2b2b2b2-0000-4000-8000-000000000002';

const htmlOf = (content: JSONContent): string => {
  const el = TranslationSSRContent({ content }) as ReactElement<DangerousProps>;
  const html = el.props.dangerouslySetInnerHTML?.__html;
  if (typeof html !== 'string') {
    throw new Error('Expected dangerouslySetInnerHTML html string');
  }
  return html;
};

const docWithMark = (attrs: Record<string, unknown>): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'passage',
      attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'The ' },
            {
              type: 'text',
              text: 'Buddha',
              marks: [{ type: 'glossaryInstance', attrs }],
            },
            { type: 'text', text: ' taught.' },
          ],
        },
      ],
    },
  ],
});

/** What differs between an instance with and without a stored authority. */
const withoutAuthorityAttr = (html: string) =>
  html.replace(/ authority="[^"]*"/g, '');

const CONTENT = 'The Buddha taught.';

const docFromStoredRow = (content: Record<string, unknown>[]): JSONContent => {
  const dto: PassageDTO = {
    sort: 1,
    type: 'translation',
    uuid: 'p-1',
    label: '1.1',
    xmlId: 'x-1',
    parent: 'parent',
    content: CONTENT,
    work_uuid: 'w-1',
    annotations: [
      {
        uuid: 'gi-1',
        passage_uuid: 'p-1',
        type: 'glossary-instance',
        start: 4,
        end: 10,
        content,
      },
    ],
  };
  const block = JSON.parse(
    JSON.stringify(
      blockFromPassage(
        passageFromDTO(
          dto,
          annotationsFromDTO(dto.annotations, CONTENT.length),
        ),
      ),
    ),
  );
  return {
    type: 'doc',
    content: [
      {
        type: 'passage',
        attrs: { uuid: 'p-1', label: '1.1', sort: 0 },
        content: block.content,
      },
    ],
  };
};

describe('reader output for glossary instances (DEV-907)', () => {
  it('[AC4] an instance with no authority is rendered as an instance of its entry', () => {
    const html = htmlOf(docWithMark({ glossary: GLOSSARY, uuid: 'gi-1' }));

    expect(html).toMatch(
      /<span[^>]*class="glossary-instance"[^>]*>Buddha<\/span>/,
    );
    expect(html).toContain(`glossary="${GLOSSARY}"`);
    expect(html).toContain('uuid="gi-1"');
    expect(html).toContain('type="glossaryInstance"');
  });

  it('[AC4] an instance with no authority leaks no undefined, null or object values', () => {
    const html = htmlOf(docWithMark({ glossary: GLOSSARY, uuid: 'gi-1' }));

    expect(html).not.toContain('undefined');
    expect(html).not.toContain('"null"');
    expect(html).not.toContain('[object Object]');
    expect(html).not.toContain('authority=""');
  });

  it('[AC4][AC5] the output is the same with and without a stored authority, apart from the authority attribute itself', () => {
    const without = htmlOf(docWithMark({ glossary: GLOSSARY, uuid: 'gi-1' }));
    const withAuthority = htmlOf(
      docWithMark({ glossary: GLOSSARY, uuid: 'gi-1', authority: AUTHORITY }),
    );

    expect(withoutAuthorityAttr(withAuthority)).toBe(without);
  });

  it('[AC5] an old instance carrying authority still renders its text, entry and identity', () => {
    const html = htmlOf(
      docWithMark({ glossary: GLOSSARY, uuid: 'gi-1', authority: AUTHORITY }),
    );

    expect(html).toMatch(
      /<span[^>]*class="glossary-instance"[^>]*>Buddha<\/span>/,
    );
    expect(html).toContain(`glossary="${GLOSSARY}"`);
    expect(html).toContain('uuid="gi-1"');
  });

  describe('from a stored row, through the editor model', () => {
    it.each([
      ['no authority', [{ uuid: GLOSSARY }]],
      [
        'authority in the same element',
        [{ uuid: GLOSSARY, authority: AUTHORITY }],
      ],
      [
        'authority in a separate element',
        [{ uuid: GLOSSARY }, { authority: AUTHORITY }],
      ],
    ])(
      '[AC4][AC5][AC7] a stored instance with %s appears in reader output',
      (_, content) => {
        const html = htmlOf(docFromStoredRow(content));

        expect(html).toMatch(
          /<span[^>]*class="glossary-instance"[^>]*>Buddha<\/span>/,
        );
        expect(html).toContain(`glossary="${GLOSSARY}"`);
        expect(html).toContain('uuid="gi-1"');
      },
    );

    it('[AC7] reader output is identical for stored rows with and without authority (the authority attribute aside)', () => {
      const without = htmlOf(docFromStoredRow([{ uuid: GLOSSARY }]));
      const same = htmlOf(
        docFromStoredRow([{ uuid: GLOSSARY, authority: AUTHORITY }]),
      );
      const separate = htmlOf(
        docFromStoredRow([{ uuid: GLOSSARY }, { authority: AUTHORITY }]),
      );

      expect(withoutAuthorityAttr(same)).toBe(without);
      expect(withoutAuthorityAttr(separate)).toBe(without);
    });
  });
});
