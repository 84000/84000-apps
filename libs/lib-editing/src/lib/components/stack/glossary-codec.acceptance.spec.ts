/**
 * Acceptance tests for DEV-883 definition criteria 4 and 5: the glossary
 * definition codec turns a stored definition into the row's editable rich text
 * and back, using the bibliography rows' inline marks, and an unedited
 * definition comes back as it went in.
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation.
 */
import type { JSONContent } from '@tiptap/core';

import {
  glossaryContentToDefinition,
  glossaryDefinitionToContent,
  glossarySchema,
} from './glossary-codec';
import { GLOSSARY_SEED_DEFINITIONS } from './glossary-seed.fixture';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const roundTrip = (definition: string) =>
  glossaryContentToDefinition(glossaryDefinitionToContent(definition));

const text = (value: string, marks: JSONContent['marks'] = []) => ({
  type: 'text',
  text: value,
  ...(marks.length ? { marks } : {}),
});
const paragraph = (...content: JSONContent[]) => ({
  type: 'paragraph',
  content,
});

/** Blocks as the schema normalizes them, defaults filled in. */
const normalized = (blocks: JSONContent[]) =>
  blocks.map((block) => glossarySchema().nodeFromJSON(block).toJSON());

/** Every text run's mark names, in the blocks. */
const markNames = (blocks: JSONContent[]): Set<string> => {
  const names = new Set<string>();
  const walk = (node: JSONContent) => {
    node.marks?.forEach((mark) => names.add(mark.type as string));
    node.content?.forEach(walk);
  };
  blocks.forEach(walk);
  return names;
};

/** The text of the blocks, run together. */
const textOf = (blocks: JSONContent[]): string => {
  const walk = (node: JSONContent): string =>
    node.text ?? (node.content ?? []).map(walk).join('');
  return blocks.map(walk).join('');
};

const plain = (html: string) => html.replace(/<[^>]+>/g, '');

describe('criterion 4: the definition is the row’s editable rich text', () => {
  it('criterion 4: the schema holds the inline marks bibliography rows use', () => {
    const marks = Object.keys(glossarySchema().marks);

    expect(marks).toEqual(
      expect.arrayContaining([
        'bold',
        'italic',
        'underline',
        'subscript',
        'superscript',
        'smallCaps',
        'foreign',
        'link',
      ]),
    );
  });

  it('criterion 4: a definition becomes paragraphs with its marks as marks', () => {
    const content = glossaryDefinitionToContent(
      '<p>The <em>karma</em> of <strong>actions</strong>, <u>u</u>, ' +
        'H<sub>2</sub>O and x<sup>2</sup>; see <a href="https://example.org/a">here</a>.</p>',
    );

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('paragraph');
    expect(textOf(content)).toBe(
      'The karma of actions, u, H2O and x2; see here.',
    );
    expect(markNames(content)).toEqual(
      new Set([
        'italic',
        'bold',
        'underline',
        'subscript',
        'superscript',
        'link',
      ]),
    );
  });

  it('criterion 4: a language span becomes a foreign mark carrying its language', () => {
    const content = glossaryDefinitionToContent(
      '<p>Sanskrit <span class="foreign break text-sa" lang="sa-LATN">dharmakṣānti</span>.</p>',
    );
    const foreign = JSON.stringify(content);

    expect(markNames(content)).toContain('foreign');
    expect(foreign).toContain('sa-LATN');
    expect(textOf(content)).toBe('Sanskrit dharmakṣānti.');
  });

  it('criterion 4: each paragraph of a definition is a paragraph of the row', () => {
    const content = glossaryDefinitionToContent('<p>One.</p><p>Two.</p>');

    expect(content.map((block) => block.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
    expect(content.map((block) => textOf([block]))).toEqual(['One.', 'Two.']);
  });

  it('criterion 4: edited text is written as a paragraph, escaping markup characters', () => {
    expect(glossaryContentToDefinition([paragraph(text('a < b & c'))])).toBe(
      '<p>a &lt; b &amp; c</p>',
    );
  });

  it('criterion 4: edited paragraphs are written one <p> each, with their marks', () => {
    const definition = glossaryContentToDefinition([
      paragraph(text('One '), text('bold', [{ type: 'bold' }])),
      paragraph(text('Two', [{ type: 'italic' }])),
    ]);

    expect(plain(definition)).toBe('One boldTwo');
    expect(definition.match(/<p[ >]/g)).toHaveLength(2);
    expect(definition).toMatch(/<(strong|b)\b/);
    expect(definition).toMatch(/<(em|i)\b/);
  });

  // Every mark in the inline set, through doc -> definition -> doc.
  const MARK_CASES: Record<string, JSONContent> = {
    bold: paragraph(text('hello', [{ type: 'bold' }])),
    italic: paragraph(text('hello', [{ type: 'italic' }])),
    underline: paragraph(text('hello', [{ type: 'underline' }])),
    subscript: paragraph(text('hello', [{ type: 'subscript' }])),
    superscript: paragraph(text('hello', [{ type: 'superscript' }])),
    smallCaps: paragraph(
      text('hello', [
        { type: 'smallCaps', attrs: { textStyle: 'small-caps' } },
      ]),
    ),
    foreign: paragraph(
      text('hello', [{ type: 'foreign', attrs: { lang: 'Bo-Ltn' } }]),
    ),
    link: paragraph(
      text('hello', [{ type: 'link', attrs: { href: 'https://e.com' } }]),
    ),
  };

  it.each(Object.keys(MARK_CASES))(
    'criterion 4: the %s mark survives being written and read back',
    (name) => {
      const blocks = [MARK_CASES[name]];
      // Every attribute the case sets is one the schema keeps.
      expect(normalized(blocks)).toMatchObject(blocks);

      const definition = glossaryContentToDefinition(blocks);

      expect(glossaryDefinitionToContent(definition)).toEqual(
        normalized(blocks),
      );
    },
  );
});

describe('criterion 5: unedited definitions round-trip', () => {
  it.each(GLOSSARY_SEED_DEFINITIONS.map(([name, html]) => [name, html]))(
    'criterion 5: the seed definition (%s) reads and writes back byte for byte',
    (_name, html) => {
      expect(roundTrip(html)).toBe(html);
    },
  );

  it.each(GLOSSARY_SEED_DEFINITIONS.map(([name, html]) => [name, html]))(
    'criterion 5: the seed definition (%s) keeps its text and links through the document',
    (_name, html) => {
      const content = glossaryDefinitionToContent(html);

      expect(textOf(content)).toBe(plain(html));
      // Identifiers a cross-reference or pointer depends on are not dropped.
      const written = glossaryContentToDefinition(content);
      for (const match of html.matchAll(
        /(data-glossary-id|href|data-pointer-type|lang)="([^"]*)"/g,
      )) {
        expect(written).toContain(`${match[1]}="${match[2]}"`);
      }
    },
  );

  const REALISTIC: [string, string][] = [
    [
      'inline marks and an external link',
      '<p>The <em>karma</em> of <strong>actions</strong> and <u>u</u>; see <a href="https://example.org/a">the page</a>.</p>',
    ],
    [
      'a glossary cross-link span',
      '<p>Also rendered here as “<span data-glossary-id="UT22084-057-004-1159">Mañjuśrī</span>.”</p>',
    ],
    [
      'Sanskrit and Tibetan spans',
      '<p>Sanskrit <span class="foreign break text-sa" lang="sa-LATN">dharmakṣānti</span> (Tibetan <span class="foreign text-wy" lang="bo-LATN">chos la bzod pa</span>).</p>',
    ],
    [
      'a passage pointer',
      '<p>See <a href="/entity/passage/5db608d7-2b91-447d-abb7-785dce7868b6" data-pointer-type="id">n.112</a>.</p>',
    ],
    [
      'several paragraphs',
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
  ];

  it.each(REALISTIC)(
    'criterion 5: %s reads and writes back byte for byte',
    (_name, html) => {
      expect(roundTrip(html)).toBe(html);
    },
  );

  it.each(REALISTIC.map(([name, html]) => [name, html]))(
    'criterion 5: %s is stable once written',
    (_name, html) => {
      const once = roundTrip(html);

      expect(roundTrip(once)).toBe(once);
    },
  );

  // TEI-ish wrappers, as converted definitions can carry them. Whitespace
  // between the wrapper's tags is not text, so it is compared without.
  const compact = (html: string) => html.replace(/>\s+</g, '><').trim();
  const WRAPPED: [string, string][] = [
    [
      'a note wrapper around a paragraph',
      '<note type="definition"> <p>A term meaning <em>acceptance</em> or patience.</p> </note>',
    ],
    [
      'a note wrapper around several paragraphs',
      '<note type="definition" rend="x">\n<p>One.</p>\n<p>Two with <span lang="sa-LATN">k</span>.</p>\n</note>',
    ],
    [
      'a division holding a note',
      '<div type="section" place="end"><note type="definition">A note</note></div>',
    ],
  ];

  it.each(WRAPPED)('criterion 5: %s keeps its text', (_name, html) => {
    const content = glossaryDefinitionToContent(html);

    expect(textOf(content).replace(/\s+/g, ' ').trim()).toBe(
      plain(html).replace(/\s+/g, ' ').trim(),
    );
  });

  it.each(WRAPPED)(
    'criterion 5: %s reads and writes back as the same definition',
    (_name, html) => {
      expect(compact(roundTrip(html))).toBe(compact(html));
    },
  );

  it('criterion 5: an empty definition stays empty', () => {
    expect(roundTrip('')).toBe('');
  });
});
