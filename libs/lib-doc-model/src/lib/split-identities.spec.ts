import type { JSONContent } from '@tiptap/core';

import { withFreshSplitIdentities } from './split-identities';

const doc = (...content: JSONContent[]): JSONContent => ({
  type: 'doc',
  content,
});

// The head and tail of a paragraph cut in two: both carry its uuid and its
// leading space, as `Fragment.cut` leaves them.
const half = (text: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'paragraph',
  attrs: {
    uuid: 'para-1',
    leadingSpace: { uuid: 'ls-1' },
    hasParagraphIndent: true,
    textAlign: 'center',
  },
  content: [{ type: 'text', text, ...(marks ? { marks } : {}) }],
});

const glossary = { type: 'glossaryInstance', attrs: { uuid: 'gi-1' } };

describe('withFreshSplitIdentities', () => {
  it('gives a block the head also holds a new uuid and drops its dependent attrs', () => {
    const [block] = withFreshSplitIdentities(
      doc(half('before ')),
      doc(half('after')),
    ).content as JSONContent[];

    expect(block.attrs?.uuid).toEqual(expect.any(String));
    expect(block.attrs?.uuid).not.toBe('para-1');
    expect(block.attrs).not.toHaveProperty('leadingSpace');
    expect(block.attrs).not.toHaveProperty('hasParagraphIndent');
    // Presentation is not identity, so it is kept.
    expect(block.attrs?.textAlign).toBe('center');
  });

  it('keeps identities the head does not hold', () => {
    const tail = doc({
      type: 'paragraph',
      attrs: { uuid: 'para-2', leadingSpace: { uuid: 'ls-2' } },
      content: [{ type: 'text', text: 'x', marks: [glossary] }],
    });

    expect(withFreshSplitIdentities(doc(half('before ')), tail)).toEqual(tail);
  });

  it('renews a mark cut in two, keeping one identity across the tail', () => {
    const head = doc(half('before ', [glossary]));
    const tail = doc({
      type: 'paragraph',
      attrs: { uuid: 'para-2' },
      content: [
        { type: 'text', text: 'a', marks: [glossary] },
        { type: 'text', text: 'b', marks: [glossary, { type: 'bold' }] },
      ],
    });

    const [block] = withFreshSplitIdentities(head, tail)
      .content as JSONContent[];
    const uuids = (block.content ?? []).map(
      (text) =>
        text.marks?.find((mark) => mark.type === 'glossaryInstance')?.attrs
          ?.uuid,
    );

    expect(uuids[0]).not.toBe('gi-1');
    expect(uuids[1]).toBe(uuids[0]);
  });

  it('renews a parameter annotation on a block with its own uuid', () => {
    const tail = doc({
      type: 'paragraph',
      attrs: { uuid: 'para-2', leadingSpace: { uuid: 'ls-1', toh: 'toh1' } },
      content: [],
    });

    const [block] = withFreshSplitIdentities(doc(half('before ')), tail)
      .content as JSONContent[];

    expect(block.attrs?.uuid).toBe('para-2');
    expect(block.attrs?.leadingSpace).toEqual({
      uuid: expect.any(String),
      toh: 'toh1',
    });
    expect((block.attrs?.leadingSpace as { uuid: string }).uuid).not.toBe(
      'ls-1',
    );
  });

  it('renews mention items the head also holds', () => {
    const mention = (uuid: string): JSONContent => ({
      type: 'mention',
      attrs: { uuid: null, items: [{ uuid }] },
    });
    const head = doc({
      type: 'paragraph',
      attrs: { uuid: 'para-1' },
      content: [mention('m-1')],
    });
    const tail = doc({
      type: 'paragraph',
      attrs: { uuid: 'para-2' },
      content: [mention('m-1'), mention('m-2')],
    });

    const [block] = withFreshSplitIdentities(head, tail)
      .content as JSONContent[];
    const items = (block.content ?? []).map(
      (node) => (node.attrs?.items as { uuid: string }[])[0].uuid,
    );

    expect(items[0]).not.toBe('m-1');
    expect(items[1]).toBe('m-2');
  });
});
