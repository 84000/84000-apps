import { withUniqueMarkUuids } from './unique-mark-uuids';

const glossary = (uuid: string | null) => ({
  type: 'glossaryInstance',
  attrs: { uuid, glossary: 'g1', authority: 'a1' },
});
const comment = { type: 'comment', attrs: { uuid: 'c1', comment: 't1' } };
const bold = { type: 'bold' };

const doc = (...content: object[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', attrs: { uuid: 'p1' }, content }],
});

const markUuids = (json: ReturnType<typeof doc>, type: string) =>
  json.content[0].content.flatMap((text) =>
    (
      (text as { marks?: { type: string; attrs?: { uuid?: string } }[] })
        .marks ?? []
    )
      .filter((mark) => mark.type === type)
      .map((mark) => mark.attrs?.uuid),
  );

describe('withUniqueMarkUuids', () => {
  it('returns null when every mark uuid is already unique', () => {
    expect(
      withUniqueMarkUuids(
        doc(
          { type: 'text', text: 'Jeta’s Grove', marks: [glossary('gi1')] },
          { type: 'text', text: ' in ' },
          { type: 'text', text: 'the park', marks: [comment] },
        ),
      ),
    ).toBeNull();
  });

  // The case that failed the stack's save: a comment over the second half of a
  // glossary instance splits it into two segments with one uuid.
  it('keeps the first segment’s uuid and gives later segments fresh ones', () => {
    const result = withUniqueMarkUuids(
      doc(
        { type: 'text', text: 'Jeta’s Grove, ', marks: [glossary('gi1')] },
        {
          type: 'text',
          text: 'Anāthapiṇḍada’s park',
          marks: [glossary('gi1'), comment],
        },
      ),
    ) as ReturnType<typeof doc>;

    const [first, second] = markUuids(result, 'glossaryInstance');
    expect(first).toBe('gi1');
    expect(second).toEqual(expect.any(String));
    expect(second).not.toBe('gi1');
    // The mark that was not duplicated is left alone.
    expect(markUuids(result, 'comment')).toEqual(['c1']);
  });

  it('stamps a uuid on a mark whose uuid is empty', () => {
    const result = withUniqueMarkUuids(
      doc({ type: 'text', text: 'x', marks: [glossary(null)] }),
    ) as ReturnType<typeof doc>;

    expect(markUuids(result, 'glossaryInstance')).toEqual([expect.any(String)]);
  });

  it('ignores marks with no uuid attribute', () => {
    expect(
      withUniqueMarkUuids(
        doc(
          { type: 'text', text: 'a', marks: [bold] },
          { type: 'text', text: 'b', marks: [bold] },
        ),
      ),
    ).toBeNull();
  });

  it('keeps the rest of the document as it was', () => {
    const input = doc(
      { type: 'text', text: 'a', marks: [glossary('gi1')] },
      { type: 'text', text: 'b', marks: [glossary('gi1')] },
    );
    const result = withUniqueMarkUuids(input) as ReturnType<typeof doc>;

    expect(result.content[0].attrs).toEqual({ uuid: 'p1' });
    expect(
      result.content[0].content.map((t) => (t as { text: string }).text),
    ).toEqual(['a', 'b']);
    // The input is not mutated.
    expect(markUuids(input, 'glossaryInstance')).toEqual(['gi1', 'gi1']);
  });
});
