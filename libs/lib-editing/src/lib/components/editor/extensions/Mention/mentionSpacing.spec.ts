import { getSchema, Node } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { MentionSSR, MentionItem } from './Mention.ssr';
import {
  mentionSpacingClass,
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

const HardBreak = Node.create({
  name: 'hardBreak',
  group: 'inline',
  inline: true,
  selectable: false,
});

const schema = getSchema([Document, Paragraph, Text, HardBreak, MentionSSR]);

const item = (overrides: Partial<MentionItem> = {}): MentionItem => ({
  uuid: 'u',
  entity: 'e',
  linkType: 'work',
  displayText: 'Ref',
  ...overrides,
});

const mention = (overrides: Partial<MentionItem> = {}) =>
  schema.node('mention', { items: [item(overrides)] });

const emptyMention = () =>
  schema.node('mention', {
    items: [{ uuid: 'u', entity: 'e', linkType: 'work' }],
  });

/** Class for the mention at `index` inside a paragraph of `children`. */
const classFor = (children: PMNode[], index: number): string => {
  const paragraph = schema.node('paragraph', null, children);
  return mentionSpacingClass(paragraph.child(index), paragraph, index);
};

describe('mentionSpacingClass', () => {
  it('adds both gaps when flanked by letters', () => {
    expect(
      classFor([schema.text('foo'), mention(), schema.text('bar')], 1),
    ).toBe(`${MENTION_SPACE_BEFORE_CLASS} ${MENTION_SPACE_AFTER_CLASS}`);
  });

  it('adds no gap next to whitespace', () => {
    expect(
      classFor([schema.text('foo '), mention(), schema.text(' bar')], 1),
    ).toBe('');
  });

  it('adds a leading gap after punctuation but no trailing gap before it', () => {
    // Leading side gets a gap even after punctuation; trailing side does not.
    expect(
      classFor([schema.text('foo.'), mention(), schema.text(',bar')], 1),
    ).toBe(MENTION_SPACE_BEFORE_CLASS);
  });

  it('adds a leading gap after a quote or bracket', () => {
    expect(
      classFor([schema.text('(foo“'), mention(), schema.text('”bar)')], 1),
    ).toBe(MENTION_SPACE_BEFORE_CLASS);
  });

  it('adds a leading gap after a Tibetan tsheg but none before a shad', () => {
    // tsheg U+0F0B before (leading gap), shad U+0F0D after (no trailing gap)
    expect(
      classFor([schema.text('foo་'), mention(), schema.text('།bar')], 1),
    ).toBe(MENTION_SPACE_BEFORE_CLASS);
  });

  it('adds no gap at the start or end of a block', () => {
    expect(classFor([mention()], 0)).toBe('');
    expect(classFor([schema.text('foo'), mention()], 1)).toBe(
      MENTION_SPACE_BEFORE_CLASS,
    );
    expect(classFor([mention(), schema.text('bar')], 0)).toBe(
      MENTION_SPACE_AFTER_CLASS,
    );
  });

  it('renders a single gap between two adjacent mentions', () => {
    const children = [mention(), mention()];
    expect(classFor(children, 0)).toBe(MENTION_SPACE_AFTER_CLASS);
    expect(classFor(children, 1)).toBe('');
  });

  it('adds no gap next to a hard break', () => {
    expect(classFor([mention(), schema.node('hardBreak')], 0)).toBe('');
    expect(classFor([schema.node('hardBreak'), mention()], 1)).toBe('');
  });

  it('adds no gap for a mention with no resolvable label', () => {
    expect(
      classFor([schema.text('foo'), emptyMention(), schema.text('bar')], 1),
    ).toBe('');
  });

  it('reads astral-plane letters without splitting surrogate pairs', () => {
    // U+1D400 MATHEMATICAL BOLD CAPITAL A (a letter) is two UTF-16 units.
    expect(classFor([schema.text('a\u{1D400}'), mention()], 1)).toBe(
      MENTION_SPACE_BEFORE_CLASS,
    );
  });
});
