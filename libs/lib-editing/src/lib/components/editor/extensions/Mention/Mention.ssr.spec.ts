import { getSchema, Node } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { MentionSSR } from './Mention.ssr';

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
  it('does not turn arrow-key caret navigation into a node selection', () => {
    const schema = getSchema([Document, Paragraph, Text, MentionSSR]);
    const mention = schema.nodes['mention'].create();

    expect(mention.isAtom).toBe(true);
    expect(NodeSelection.isSelectable(mention)).toBe(false);
  });
});
