import { getSchema, Node } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import {
  MentionSSR,
  MentionItem,
  mentionContainerToh,
  mentionDOMOutputSpec,
} from './Mention.ssr';

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph+',
});

const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
});

const Text = Node.create({
  name: 'text',
  group: 'inline',
});

describe('MentionSSR', () => {
  it('is draggable without turning caret navigation into a node selection', () => {
    const schema = getSchema([Document, Paragraph, Text, MentionSSR]);
    const mention = schema.nodes['mention'].create();

    expect(mention.isAtom).toBe(true);
    expect(schema.nodes['mention'].spec.draggable).toBe(true);
    expect(NodeSelection.isSelectable(mention)).toBe(false);
  });
});

describe('mentionDOMOutputSpec same-work links', () => {
  const schema = getSchema([Document, Paragraph, Text, MentionSSR]);

  /** The attrs of the anchor a single same-work item renders to. */
  const anchorAttrs = (item: Partial<MentionItem>) => {
    const node = schema.nodes['mention'].create({
      items: [
        {
          uuid: 'm-1',
          entity: 'p-1',
          linkType: 'passage',
          displayText: 'a passage',
          isSameWork: true,
          ...item,
        },
      ],
    });
    // The container's children are spread into the spec, so the first item
    // sits at index 2 rather than inside a nested array.
    const spec = mentionDOMOutputSpec(node) as [
      string,
      unknown,
      [string, Record<string, string>, string],
    ];
    return spec[2][1];
  };

  it('carries the highlight range a static row has no other source for', () => {
    expect(anchorAttrs({ highlightStart: 12, highlightEnd: 20 })).toMatchObject(
      {
        'data-same-work': 'true',
        'data-highlight-start': '12',
        'data-highlight-end': '20',
      },
    );
  });

  it('omits the range when the mention names none', () => {
    const attrs = anchorAttrs({});
    expect(attrs['data-highlight-start']).toBeUndefined();
    expect(attrs['data-highlight-end']).toBeUndefined();
  });
});

describe('mentionContainerToh', () => {
  const item = (toh?: string): MentionItem => ({
    uuid: 'u',
    entity: 'e',
    linkType: 'work',
    ...(toh !== undefined ? { toh } : {}),
  });

  it('returns undefined when there are no items', () => {
    expect(mentionContainerToh([])).toBeUndefined();
  });

  it('returns undefined when any item is unscoped (must stay visible)', () => {
    expect(mentionContainerToh([item('toh1'), item()])).toBeUndefined();
  });

  it('unions the toh tokens of all items, de-duplicated', () => {
    expect(mentionContainerToh([item('toh1'), item('toh2')])).toBe('toh1,toh2');
    expect(mentionContainerToh([item('toh1,toh2'), item('toh2')])).toBe(
      'toh1,toh2',
    );
  });

  it('handles a single item whose toh is already a comma list', () => {
    expect(mentionContainerToh([item('toh1,toh3')])).toBe('toh1,toh3');
  });
});
