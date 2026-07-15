import { getSchema, Node } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { MentionSSR } from './Mention.ssr';
import { mentionDropSelectionPlugin } from './MentionDropSelection';

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

const schema = getSchema([Document, Paragraph, Text, MentionSSR]);

const createState = () =>
  EditorState.create({
    schema,
    doc: schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.node('mention'),
        schema.text('text'),
      ]),
    ]),
    plugins: [mentionDropSelectionPlugin('mention')],
  });

describe('mentionDropSelectionPlugin', () => {
  it('collapses the range around a dropped mention to its right side', () => {
    const state = createState();
    const drop = state.tr
      .setSelection(TextSelection.create(state.doc, 1, 2))
      .setMeta('uiEvent', 'drop');

    const result = state.applyTransaction(drop).state;

    expect(result.selection.empty).toBe(true);
    expect(result.selection.from).toBe(2);
  });

  it('preserves other selections created by a drop', () => {
    const state = createState();
    const drop = state.tr
      .setSelection(TextSelection.create(state.doc, 2, 4))
      .setMeta('uiEvent', 'drop');

    const result = state.applyTransaction(drop).state;

    expect(result.selection.empty).toBe(false);
    expect(result.selection.from).toBe(2);
    expect(result.selection.to).toBe(4);
  });
});
