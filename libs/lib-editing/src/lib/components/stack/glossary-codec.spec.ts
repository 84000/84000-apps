import {
  glossaryContentToDefinition,
  glossaryDefinitionToContent,
  glossaryRowSource,
} from './glossary-codec';

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
  '<p>Nested <span data-glossary-id="a">outer <span lang="bo">inner</span></span> spans.</p>',
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

  it('lifts paragraphs out of the wrappers around them', () => {
    expect(
      glossaryDefinitionToContent(STORED[1]).map((block) => block.type),
    ).toEqual(['paragraph']);
    expect(
      glossaryDefinitionToContent(STORED[4]).map((block) => block.type),
    ).toEqual(['paragraph', 'paragraph']);
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
    expect(glossaryContentToDefinition(glossaryDefinitionToContent(null))).toBe(
      null,
    );
    expect(glossaryContentToDefinition(glossaryDefinitionToContent(''))).toBe(
      null,
    );
  });
});

describe('glossaryContentToDefinition', () => {
  it.each(STORED)('keeps the text and inline markup of %s', (stored) => {
    const once = roundTrip(stored);
    expect(once).not.toBeNull();
    const before = document.createElement('div');
    before.innerHTML = stored;
    const after = document.createElement('div');
    after.innerHTML = once ?? '';
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

  it('keeps nested markup of one kind nested', () => {
    expect(roundTrip(STORED[5])).toBe(
      '<p>Nested <span data-glossary-id="a">outer <span lang="bo">inner</span></span> spans.</p>',
    );
  });

  it('writes no definition for blocks without text', () => {
    expect(
      glossaryContentToDefinition([{ type: 'paragraph', content: [] }]),
    ).toBe(null);
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
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
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
