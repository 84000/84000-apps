import type { JSONContent } from '@tiptap/core';

import {
  glossaryContentToDefinition,
  glossaryDefinitionToContent,
  glossaryRowSource,
  glossarySchema,
} from './glossary-codec';
import { GLOSSARY_SEED_DEFINITIONS } from './glossary-seed.fixture';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const roundTrip = (definition: string | null) =>
  glossaryContentToDefinition(glossaryDefinitionToContent(definition));

/** Stored definitions in the shapes the glossary holds. */
const STORED = [
  '<p class="definition">A <span data-glossary-id="UT22084-058-004-1170">god</span>.</p>',
  '<note type="definition"> <p>One of the <term>four great kings</term>.</p> </note> ',
  '<p>See <cite>The Sūtra of Golden Light</cite>, <ref target="https://example.org">here</ref>.</p>',
  '<p>From <foreign lang="Sa-Ltn">mahā</foreign> <em>great</em> <emph rend="bold">and</emph> <a href="https://example.org">more</a>.</p>',
  '<div><p>One.</p><p>Two.</p></div>',
  '<p>Nested <span lang="bo">outer <span data-glossary-id="a">inner</span></span> spans.</p>',
  '<p>A <distinct>name</distinct> with <hi rend="italic">emphasis</hi>.</p>',
];

/** Empty elements, written as XML writes them. */
const EMPTY = [
  '<p>A <ptr target="#UT22084-076-011-160"/> pointer.</p>',
  '<p>See <span class="ref-pending" data-href="/entity/work/w-1"/> and <a href="/entity/passage/p-1"/>, <ref rend="pending" target="http://read.84000.co/translation/toh6.html"/>.</p>',
];

describe('glossaryDefinitionToContent', () => {
  it('keeps cross-links with their attributes', () => {
    const [paragraph] = glossaryDefinitionToContent(STORED[0]);
    const god = paragraph.content?.find((node) => node.text === 'god');
    expect(god?.marks).toEqual([
      {
        type: 'definitionMarkup',
        attrs: {
          tag: 'span',
          attributes: { 'data-glossary-id': 'UT22084-058-004-1170' },
        },
      },
    ]);
  });

  it('keeps the wrappers around paragraphs', () => {
    const blocks = (stored: string) =>
      glossaryDefinitionToContent(stored).map((block) => [
        block.type,
        block.content?.map((child) => child.type),
      ]);
    expect(blocks(STORED[1])).toEqual([['definitionWrapper', ['paragraph']]]);
    expect(blocks(STORED[4])).toEqual([
      ['definitionWrapper', ['paragraph', 'paragraph']],
    ]);
    expect(roundTrip(STORED[4])).toBe(STORED[4]);
  });

  it('reads the editor marks it knows as themselves', () => {
    const [paragraph] = glossaryDefinitionToContent(STORED[3]);
    const marks = (text: string) =>
      paragraph.content
        ?.find((node) => node.text === text)
        ?.marks?.map((mark) => mark.type);
    expect(marks('great')).toEqual(['italic']);
    expect(marks('more')).toEqual(['link']);
  });

  it('reads an empty definition as no blocks of text', () => {
    expect(roundTrip(null)).toBe('');
    expect(roundTrip('')).toBe('');
  });
});

describe('glossaryContentToDefinition', () => {
  it.each(STORED)('keeps the text and inline markup of %s', (stored) => {
    const once = roundTrip(stored);
    const before = document.createElement('div');
    before.innerHTML = stored;
    const after = document.createElement('div');
    after.innerHTML = once;
    expect(after.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      before.textContent?.replace(/\s+/g, ' ').trim(),
    );
    for (const element of before.querySelectorAll(
      'span, cite, term, ref, foreign, emph, distinct, hi, ptr, a',
    )) {
      const kept = [...after.querySelectorAll(element.tagName)].some(
        (each) =>
          each.textContent === element.textContent &&
          [...element.attributes].every(
            ({ name, value }) =>
              name === 'class' || each.getAttribute(name) === value,
          ),
      );
      expect(kept).toBe(true);
    }
  });

  it.each(STORED)('is stable once written: %s', (stored) => {
    const once = roundTrip(stored);
    expect(roundTrip(once)).toBe(once);
  });

  it('writes paragraphs and links bare', () => {
    expect(roundTrip(STORED[3])).toBe(
      '<p>From <foreign lang="Sa-Ltn">mahā</foreign> <em>great</em> <emph rend="bold">and</emph> <a href="https://example.org">more</a>.</p>',
    );
  });

  it('keeps empty elements empty, the text after them outside', () => {
    expect(roundTrip(EMPTY[0])).toBe(
      '<p>A <ptr target="#UT22084-076-011-160"></ptr> pointer.</p>',
    );
    expect(roundTrip(EMPTY[1])).toBe(
      '<p>See <span class="ref-pending" data-href="/entity/work/w-1"></span> and <a href="/entity/passage/p-1"></a>, <ref rend="pending" target="http://read.84000.co/translation/toh6.html"></ref>.</p>',
    );
    EMPTY.forEach((stored) => {
      const once = roundTrip(stored);
      expect(roundTrip(once)).toBe(once);
    });
  });

  it('keeps line breaks', () => {
    expect(roundTrip('<p>One<br>two.</p>')).toBe('<p>One<br>two.</p>');
  });

  it('keeps cross-links nested in language spans', () => {
    expect(roundTrip(STORED[5])).toBe(STORED[5]);
  });

  it('writes no definition for blocks without text', () => {
    expect(
      glossaryContentToDefinition([{ type: 'paragraph', content: [] }]),
    ).toBe('');
  });
});

/** The text of each paragraph, in order, wherever it sits. */
const paragraphTexts = (blocks: JSONContent[]): string[] =>
  blocks.flatMap((block) =>
    block.type === 'paragraph'
      ? [(block.content ?? []).map((child) => child.text ?? '').join('')]
      : paragraphTexts(block.content ?? []),
  );

describe('an unedited definition', () => {
  it.each(GLOSSARY_SEED_DEFINITIONS)(
    'writes back byte for byte: seed %s',
    (_name, stored) => {
      expect(roundTrip(stored)).toBe(stored);
    },
  );

  it.each(GLOSSARY_SEED_DEFINITIONS)(
    'keeps its text and identifiers through the document: seed %s',
    (_name, stored) => {
      const content = glossaryDefinitionToContent(stored);
      const text = (node: JSONContent): string =>
        node.text ?? (node.content ?? []).map(text).join('');
      expect(content.map(text).join('')).toBe(stored.replace(/<[^>]+>/g, ''));
      const written = glossaryContentToDefinition(content);
      for (const [attribute] of stored.matchAll(
        /(data-glossary-id|href|data-pointer-type|lang)="[^"]*"/g,
      )) {
        expect(written).toContain(attribute);
      }
    },
  );

  it.each([
    [
      'inline marks and an external link',
      '<p>The <em>karma</em> of <strong>actions</strong> and <u>u</u>; see <a href="https://example.org/a">the page</a>.</p>',
    ],
    [
      'language spans with classes',
      '<p>Sanskrit <span class="foreign break text-sa" lang="sa-LATN">dharmakṣānti</span> (Tibetan <span class="foreign text-wy" lang="bo-LATN">chos la bzod pa</span>).</p>',
    ],
    [
      'a passage pointer',
      '<p>See <a href="/entity/passage/5db608d7-2b91-447d-abb7-785dce7868b6" data-pointer-type="id">n.112</a>.</p>',
    ],
    [
      'paragraph classes',
      '<p class="definition">First.</p><p class="definition">Second, with <em>emphasis</em>.</p>',
    ],
    ['soft hyphens', '<p>Prajñā­pāramitā­sūtra.</p>'],
    [
      'a trailing space',
      '<p>Indian beech tree (<em>pongamia glabra</em>); used medicinally. </p>',
    ],
    [
      'Tibetan script',
      '<p>Tibetan <span lang="bo">སེམས་བསྐྱེད།</span> here.</p>',
    ],
  ])('writes back byte for byte: %s', (_name, stored) => {
    expect(roundTrip(stored)).toBe(stored);
  });

  it.each([
    [
      'a note around a paragraph',
      '<note type="definition"> <p>A term meaning <em>acceptance</em> or patience.</p> </note>',
      ['A term meaning acceptance or patience.'],
    ],
    [
      'a note around several paragraphs',
      '<note type="definition" rend="x">\n<p>One.</p>\n<p>Two with <span lang="sa-LATN">k</span>.</p>\n</note>',
      ['One.', 'Two with k.'],
    ],
    [
      'a division holding a bare note',
      '<div type="section" place="end"><note type="definition">A note</note></div>',
      ['A note'],
    ],
  ])(
    'keeps its wrappers, losing only the whitespace between them: %s',
    (_name, stored, paragraphs) => {
      expect(paragraphTexts(glossaryDefinitionToContent(stored))).toEqual(
        paragraphs,
      );
      const compact = (html: string) => html.replace(/>\s+</g, '><').trim();
      expect(compact(roundTrip(stored))).toBe(compact(stored));
    },
  );

  it('reads a language span as the foreign mark, with its language', () => {
    const [paragraph] = glossaryDefinitionToContent(
      '<p>Sanskrit <span class="foreign break text-sa" lang="sa-LATN">dharmakṣānti</span>.</p>',
    );
    const word = paragraph.content?.find(
      (node) => node.text === 'dharmakṣānti',
    );
    expect(word?.marks).toEqual([
      expect.objectContaining({
        type: 'foreign',
        attrs: expect.objectContaining({ lang: 'sa-LATN' }),
      }),
    ]);
  });
});

describe('a definition the editor wrote', () => {
  const text = (value: string, marks: JSONContent['marks']) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: value, marks }],
  });
  const MARKS: [string, JSONContent][] = [
    ['bold', text('hello', [{ type: 'bold' }])],
    ['italic', text('hello', [{ type: 'italic' }])],
    ['underline', text('hello', [{ type: 'underline' }])],
    ['subscript', text('hello', [{ type: 'subscript' }])],
    ['superscript', text('hello', [{ type: 'superscript' }])],
    [
      'smallCaps',
      text('hello', [
        { type: 'smallCaps', attrs: { textStyle: 'small-caps' } },
      ]),
    ],
    [
      'foreign',
      text('hello', [{ type: 'foreign', attrs: { lang: 'Bo-Ltn' } }]),
    ],
    [
      'link',
      text('hello', [{ type: 'link', attrs: { href: 'https://e.com' } }]),
    ],
  ];

  it.each(MARKS)('reads back as written: %s', (_name, block) => {
    const written = [glossarySchema().nodeFromJSON(block).toJSON()];
    expect(written).toMatchObject([block]);
    expect(
      glossaryDefinitionToContent(glossaryContentToDefinition([block])),
    ).toEqual(written);
  });
});

describe('glossaryRowSource', () => {
  const WORK = 'work-1';

  it('seeds each row from its definition', async () => {
    const read = jest.fn(async (uuids: string[]) =>
      uuids.map((uuid) => ({ uuid, definition: `<p>${uuid}</p>` })),
    );
    const source = glossaryRowSource({ workUuid: WORK, read });
    const snapshots = await source.loadPassages(WORK, ['a', 'b']);
    expect(read).toHaveBeenCalledWith(['a', 'b']);
    expect(snapshots.map(({ uuid }) => uuid)).toEqual(['a', 'b']);
    expect(snapshots[0].content).toEqual([
      {
        type: 'paragraph',
        attrs: { stored: null },
        content: [{ type: 'text', text: 'a' }],
      },
    ]);
  });

  it('reads nothing for another work or no rows', async () => {
    const read = jest.fn(async () => []);
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const source = glossaryRowSource({ workUuid: WORK, read });
    expect(await source.loadPassages('other', ['a'])).toEqual([]);
    expect(await source.loadPassages(WORK, [])).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
