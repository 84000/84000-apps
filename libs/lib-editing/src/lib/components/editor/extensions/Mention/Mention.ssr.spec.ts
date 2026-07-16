import { getSchema, Node } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { MentionSSR, MentionItem, mentionContainerToh } from './Mention.ssr';

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
