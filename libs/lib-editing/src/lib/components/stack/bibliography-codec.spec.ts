import type { JSONContent } from '@tiptap/core';

import {
  bibliographyContentToHTML,
  bibliographyHTMLToContent,
  bibliographyRowSource,
  bibliographySchema,
} from './bibliography-codec';
import { BIBLIOGRAPHY_SEED_ROWS } from './bibliography-seed.fixture';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const schema = bibliographySchema();

const roundTrip = (html: string, isHeading: boolean) => {
  const kind = isHeading ? 'heading' : 'entry';
  return bibliographyContentToHTML(bibliographyHTMLToContent(html, kind), kind);
};

/** Blocks as the schema normalizes them, defaults filled in. */
const normalized = (blocks: JSONContent[]) =>
  blocks.map((block) => schema.nodeFromJSON(block).toJSON());

const text = (value: string, marks: JSONContent['marks'] = []) => ({
  type: 'text',
  text: value,
  ...(marks.length ? { marks } : {}),
});

const paragraph = (...content: JSONContent[]) => ({
  type: 'paragraph',
  content,
});

describe('bibliography schema', () => {
  it('holds the inline set and nothing that belongs to passage structure', () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(
      ['doc', 'mention', 'paragraph', 'text'].sort(),
    );
    expect(Object.keys(schema.marks).sort()).toEqual(
      [
        'bold',
        'comment',
        'foreign',
        'glossaryInstance',
        'internalLink',
        'italic',
        'link',
        'smallCaps',
        'subscript',
        'superscript',
        'underline',
      ].sort(),
    );
  });
});

describe('seed bibliography rows', () => {
  it('covers every seeded work', () => {
    expect(new Set(BIBLIOGRAPHY_SEED_ROWS.map((row) => row.toh))).toEqual(
      new Set(['toh90001', 'toh145', 'toh251']),
    );
  });

  it.each(
    BIBLIOGRAPHY_SEED_ROWS.map((row) => [
      `${row.toh} ${row.isHeading ? 'heading' : 'entry'} ${row.sort}`,
      row,
    ]),
  )('%s round trips byte for byte', (_name, row) => {
    expect(roundTrip(row.html, row.isHeading)).toBe(row.html);
  });

  it('reads a heading as one plain paragraph', () => {
    expect(bibliographyHTMLToContent('Tibetan Texts', 'heading')).toEqual([
      paragraph(text('Tibetan Texts')),
    ]);
  });

  it('reads a heading’s markup characters as text', () => {
    expect(bibliographyHTMLToContent('A & B <i> &lt;', 'heading')).toEqual([
      paragraph(text('A & B <i> &lt;')),
    ]);
    expect(roundTrip('A & B <i> &lt;', true)).toBe('A & B <i> &lt;');
  });

  it('keeps soft hyphens as text', () => {
    const row = BIBLIOGRAPHY_SEED_ROWS.find((r) => r.html.includes('­'));
    const content = JSON.stringify(
      bibliographyHTMLToContent(row?.html ?? '', 'entry'),
    );

    expect(content).toContain('Tathāgata­mahā­karuṇā');
  });

  it('nests formatting outside a link, as entries store it', () => {
    const html = '<p><em><a href="https://e.com">Title</a></em>.</p>';

    expect(roundTrip(html, false)).toBe(html);
  });
});

describe('whitespace', () => {
  it.each([
    ['a trailing space', '<p>Oxford, 1899. </p>'],
    ['a run of spaces', '<p>one   two</p>'],
    ['a newline, as text rather than a break', '<p>one\ntwo</p>'],
    ['leading space in a heading', '  Other Sources'],
  ])('keeps %s', (_name, html) => {
    expect(roundTrip(html, !html.startsWith('<p>'))).toBe(html);
  });

  it('keeps a newline as a newline in the document', () => {
    expect(bibliographyHTMLToContent('<p>one\ntwo</p>', 'entry')).toEqual([
      paragraph(text('one\ntwo')),
    ]);
  });

  it('drops whitespace between paragraphs rather than making one of it', () => {
    expect(roundTrip('<p>one</p>\n<p>two</p>', false)).toBe(
      '<p>one</p><p>two</p>',
    );
  });
});

describe('serializing a row', () => {
  it('stores a heading without a wrapper, its paragraphs joined', () => {
    expect(
      bibliographyContentToHTML(
        [paragraph(text('Other')), paragraph(text('Sources'))],
        'heading',
      ),
    ).toBe('Other Sources');
  });

  it('stores a heading as its text, without marks or escaping', () => {
    expect(
      bibliographyContentToHTML(
        [
          paragraph(
            text('A & ', [{ type: 'italic' }]),
            text('B', [{ type: 'link', attrs: { href: 'https://e.com' } }]),
            text(' see '),
            {
              type: 'mention',
              attrs: { items: [{ uuid: 'i-1', text: 'The Work' }] },
            },
          ),
        ],
        'heading',
      ),
    ).toBe('A & B see The Work');
  });

  it('stores an empty row as an empty string', () => {
    expect(bibliographyContentToHTML([{ type: 'paragraph' }], 'entry')).toBe(
      '',
    );
    expect(roundTrip('', true)).toBe('');
  });

  it('escapes markup characters in text', () => {
    expect(
      bibliographyContentToHTML([paragraph(text('a < b & c'))], 'entry'),
    ).toBe('<p>a &lt; b &amp; c</p>');
  });
});

/**
 * Every mark and inline node in the set, through doc → HTML → doc. A comment
 * anchor is stored inline in the row's HTML, so it has to make the trip with
 * its identity; the rest keep every attribute they carry. There is no
 * annotation `toh` scope or node uuid here: the schema has no
 * `TranslationMetadata`, so a case carrying one would pass by dropping it on
 * both sides.
 */
const MARK_CASES: Record<string, JSONContent> = {
  bold: paragraph(text('hello', [{ type: 'bold' }])),
  italic: paragraph(text('hello', [{ type: 'italic' }])),
  underline: paragraph(text('hello', [{ type: 'underline' }])),
  subscript: paragraph(text('hello', [{ type: 'subscript' }])),
  superscript: paragraph(text('hello', [{ type: 'superscript' }])),
  smallCaps: paragraph(
    text('hello', [{ type: 'smallCaps', attrs: { textStyle: 'small-caps' } }]),
  ),
  foreign: paragraph(
    text('hello', [{ type: 'foreign', attrs: { lang: 'Bo-Ltn' } }]),
  ),
  link: paragraph(
    text('hello', [{ type: 'link', attrs: { href: 'https://e.com' } }]),
  ),
  internalLink: paragraph(
    text('hello', [
      {
        type: 'internalLink',
        attrs: {
          uuid: 'm-1',
          entity: 'entity-1',
          type: 'work',
          href: '/x',
          isSameWork: false,
        },
      },
    ]),
  ),
  glossaryInstance: paragraph(
    text('hello', [
      {
        type: 'glossaryInstance',
        attrs: { uuid: 'm-1', glossary: 'glossary-1', authority: 'auth-1' },
      },
    ]),
  ),
  comment: paragraph(
    text('hello', [
      { type: 'comment', attrs: { uuid: 'anchor-1', comment: 'comment-1' } },
    ]),
  ),
  mention: paragraph(text('see '), {
    type: 'mention',
    attrs: {
      items: [
        {
          uuid: 'item-1',
          entity: 'entity-1',
          linkType: 'work',
          text: 'The Work',
          toh: 'toh417',
        },
      ],
    },
  }),
  overlapping: paragraph(
    text('a ', [{ type: 'italic' }]),
    text('b', [
      { type: 'italic' },
      { type: 'comment', attrs: { uuid: 'anchor-1', comment: 'comment-1' } },
    ]),
    text(' c', [
      { type: 'comment', attrs: { uuid: 'anchor-1', comment: 'comment-1' } },
    ]),
  ),
};

describe('marks survive doc → HTML → doc', () => {
  it.each(Object.keys(MARK_CASES))('%s', (name) => {
    const blocks = [MARK_CASES[name]];
    // Every attribute the case sets is one the schema keeps.
    expect(normalized(blocks)).toMatchObject(blocks);

    const html = bibliographyContentToHTML(blocks, 'entry');

    expect(bibliographyHTMLToContent(html, 'entry')).toEqual(
      normalized(blocks),
    );
  });

  it('stores a link as its href alone', () => {
    const blocks = [
      paragraph(
        text('hello', [
          { type: 'link', attrs: { href: 'https://e.com', uuid: 'm-1' } },
        ]),
      ),
    ];

    expect(bibliographyContentToHTML(blocks, 'entry')).toBe(
      '<p><a href="https://e.com">hello</a></p>',
    );
  });

  it.each(['javascript:alert(1)', ' data:text/html,x'])(
    'stores an unsafe href (%s) as an inert anchor',
    (href) => {
      const blocks = [
        paragraph(text('hello', [{ type: 'link', attrs: { href } }])),
      ];
      const html = bibliographyContentToHTML(blocks, 'entry');

      expect(html).toBe('<p><a>hello</a></p>');
      expect(bibliographyHTMLToContent(html, 'entry')).toEqual([
        paragraph(text('hello')),
      ]);
    },
  );

  it('is stable once stored', () => {
    Object.values(MARK_CASES).forEach((block) => {
      const html = bibliographyContentToHTML([block], 'entry');

      expect(roundTrip(html, false)).toBe(html);
    });
  });
});

describe('bibliographyRowSource', () => {
  const read = jest.fn(async (uuids: string[]) =>
    uuids
      .filter((uuid) => uuid !== 'missing')
      .map((uuid) => ({
        uuid,
        html: '<p><em>Title</em>. 2020.</p>',
        isHeading: false,
      })),
  );
  const source = bibliographyRowSource({ workUuid: 'w1', read });

  beforeEach(() => read.mockClear());

  it('seeds each row from its stored HTML', async () => {
    const snapshots = await source.loadPassages('w1', ['b1', 'missing']);

    expect(snapshots).toEqual([
      {
        uuid: 'b1',
        content: normalized([
          paragraph(text('Title', [{ type: 'italic' }]), text('. 2020.')),
        ]),
      },
    ]);
  });

  it('seeds a heading row from its text', async () => {
    const headings = bibliographyRowSource({
      workUuid: 'w1',
      read: async () => [{ uuid: 'h1', html: 'A & <B>', isHeading: true }],
    });

    expect(await headings.loadPassages('w1', ['h1'])).toEqual([
      { uuid: 'h1', content: [paragraph(text('A & <B>'))] },
    ]);
  });

  it('answers for its own work only', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => null);

    expect(await source.loadPassages('w2', ['b1'])).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
