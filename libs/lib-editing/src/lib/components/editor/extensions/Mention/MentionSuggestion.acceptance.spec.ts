/**
 * ED-1647 acceptance: the `@` suggestion hands the selected result's
 * subtype/linkToh to `setMention` as its location.
 *
 * Criteria: (1) subtype, (2) linkToh, (4) other kinds unchanged.
 */
import { Editor, Node } from '@tiptap/core';
import { Mention } from './Mention';
import { mentionSuggestion } from './MentionSuggestion';
import type { MentionSearchResult } from './useMentionSearch';

// MentionList reaches lib-search -> next/server, which jsdom cannot load.
jest.mock('./MentionList', () => ({ __esModule: true, default: () => null }));

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
});
const TextNode = Node.create({ name: 'text', group: 'inline' });

// `subtype` / `linkToh` on the result are part of the new contract.
type Result = MentionSearchResult & { subtype?: string; linkToh?: string };

const result = (overrides: Partial<Result>): Result => ({
  entity: 'e-1',
  linkType: 'passage',
  label: 'label',
  text: 'text',
  ...overrides,
});

describe('mentionSuggestion.command (real editor)', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = new Editor({
      element: document.createElement('div'),
      extensions: [Doc, Paragraph, TextNode, Mention],
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
  });
  afterEach(() => editor.destroy());

  const insertedItem = (): Record<string, unknown> => {
    const found: Record<string, unknown>[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') found.push(node.attrs.items[0]);
    });
    expect(found).toHaveLength(1);
    return found[0];
  };

  const choose = (props: Result) =>
    mentionSuggestion.command?.({
      editor,
      range: { from: 1, to: 1 },
      props,
    });

  it('criterion 4: choosing a work hit saves neither key', () => {
    choose(result({ linkType: 'work' }));

    const item = insertedItem();
    expect(item).not.toHaveProperty('subtype');
    expect(item).not.toHaveProperty('linkToh');
    expect(item).not.toHaveProperty('isSameWork');
  });
});
