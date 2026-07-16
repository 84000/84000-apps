import { getSchema, Node } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import type { DecorationSet } from '@tiptap/pm/view';
import { MentionSSR, MentionItem } from './Mention.ssr';
import { mentionSpacingPlugin } from './MentionSpacingPlugin';
import {
  MENTION_SPACE_AFTER_CLASS,
  MENTION_SPACE_BEFORE_CLASS,
} from './mentionSpacing';

const Document = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+',
});

const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
});

const Text = Node.create({ name: 'text', group: 'inline' });

const schema = getSchema([Document, Paragraph, Text, MentionSSR]);

const item = (): MentionItem => ({
  uuid: 'u',
  entity: 'e',
  linkType: 'work',
  displayText: 'Ref',
});

const mention = () => schema.node('mention', { items: [item()] });

/** The class strings of every decoration in the set, in document order. */
const decoClasses = (set: DecorationSet): string[] =>
  set
    .find()
    // `type.attrs` is where prosemirror-view stores node-decoration attributes.
    .map((deco) => (deco as unknown as { type: { attrs: { class: string } } }).type.attrs.class);

const stateFor = (doc: PMNodeDoc) => {
  const plugin = mentionSpacingPlugin();
  const state = EditorState.create({ schema, doc, plugins: [plugin] });
  return { plugin, state };
};

type PMNodeDoc = ReturnType<typeof schema.node>;

const para = (...children: PMNodeDoc[]) => schema.node('paragraph', null, children);
const doc = (...paragraphs: PMNodeDoc[]) => schema.node('doc', null, paragraphs);

describe('mentionSpacingPlugin', () => {
  it('decorates a mention flanked by letters with both classes', () => {
    const { plugin, state } = stateFor(
      doc(para(schema.text('foo'), mention(), schema.text('bar'))),
    );
    expect(decoClasses(plugin.getState(state) as DecorationSet)).toEqual([
      `${MENTION_SPACE_BEFORE_CLASS} ${MENTION_SPACE_AFTER_CLASS}`,
    ]);
  });

  it('adds the after-class when text is typed directly after a mention', () => {
    const { plugin, state } = stateFor(doc(para(schema.text('foo'), mention())));
    expect(decoClasses(plugin.getState(state) as DecorationSet)).toEqual([
      MENTION_SPACE_BEFORE_CLASS,
    ]);

    // Mention sits at pos 4 (nodeSize 1); pos 5 is just after it, in-block.
    const next = state.apply(state.tr.insertText('x', 5));
    expect(decoClasses(plugin.getState(next) as DecorationSet)).toEqual([
      `${MENTION_SPACE_BEFORE_CLASS} ${MENTION_SPACE_AFTER_CLASS}`,
    ]);
  });

  it('removes the before-class when punctuation is typed before a mention', () => {
    const { plugin, state } = stateFor(doc(para(schema.text('foo'), mention())));
    expect(decoClasses(plugin.getState(state) as DecorationSet)).toEqual([
      MENTION_SPACE_BEFORE_CLASS,
    ]);

    // Insert '.' at pos 4, immediately before the mention.
    const next = state.apply(state.tr.insertText('.', 4));
    expect(decoClasses(plugin.getState(next) as DecorationSet)).toEqual([]);
  });

  it('renders a single gap between two adjacent mentions', () => {
    const { plugin, state } = stateFor(doc(para(mention(), mention())));
    expect(decoClasses(plugin.getState(state) as DecorationSet)).toEqual([
      MENTION_SPACE_AFTER_CLASS,
    ]);
  });

  it('leaves decorations untouched when an unrelated paragraph is edited', () => {
    const { plugin, state } = stateFor(
      doc(
        para(schema.text('foo'), mention(), schema.text('bar')),
        para(schema.text('other')),
      ),
    );
    const before = decoClasses(plugin.getState(state) as DecorationSet);

    // Type in the second paragraph; the first paragraph's mention is unaffected.
    const secondParaEnd = state.doc.content.size - 1;
    const next = state.apply(state.tr.insertText('!', secondParaEnd));

    expect(decoClasses(plugin.getState(next) as DecorationSet)).toEqual(before);
  });
});
