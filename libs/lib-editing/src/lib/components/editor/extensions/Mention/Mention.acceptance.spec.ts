/**
 * ED-1647 acceptance: `setMention` location argument.
 *
 * Criteria: (1) a same-work passage mention carries the target passage's
 * section type as `subtype`; (2) it carries the target's Toh as `linkToh`;
 * (4) mentions without a location are saved as before.
 */
import { Editor, Node } from '@tiptap/core';
import { Mention } from './Mention';

// The `@` suggestion's popup list reaches lib-search -> next/server, which
// jsdom cannot load. These tests never open it.
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

const createEditor = () =>
  new Editor({
    element: document.createElement('div'),
    extensions: [Doc, Paragraph, TextNode, Mention],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  });

// The command's declared signature is the contract under test; the 5th
// argument does not exist on main, so call through a loose type.
type SetMention = (
  entity: string,
  linkType: string,
  displayText?: string,
  isSameWork?: boolean,
  location?: { subtype?: string; linkToh?: string },
) => boolean;

/** The `items[0]` of the mention the editor ended up holding. */
const insertedItem = (editor: Editor): Record<string, unknown> => {
  const found: Record<string, unknown>[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'mention') found.push(node.attrs.items[0]);
  });
  expect(found).toHaveLength(1);
  return found[0];
};

let editor: Editor;
beforeEach(() => {
  editor = createEditor();
});
afterEach(() => editor.destroy());

const setMention = (...args: Parameters<SetMention>) =>
  (editor.commands as unknown as { setMention: SetMention }).setMention(
    ...args,
  );

describe('setMention location (ED-1647)', () => {
  it.each(['endnotes', 'introduction', 'translation'])(
    'criterion 1: saves the target section type %s as subtype',
    (subtype) => {
      setMention('p-1', 'passage', 'label', true, { subtype });

      expect(insertedItem(editor)).toMatchObject({
        entity: 'p-1',
        linkType: 'passage',
        isSameWork: true,
        subtype,
      });
    },
  );

  it('criterion 2: saves the target Toh as linkToh', () => {
    setMention('p-1', 'passage', 'label', true, {
      subtype: 'endnotes',
      linkToh: 'toh12',
    });

    expect(insertedItem(editor)).toMatchObject({
      subtype: 'endnotes',
      linkToh: 'toh12',
    });
  });

  it('criterion 2: saves linkToh even when the passage has no subtype', () => {
    setMention('p-1', 'passage', 'label', true, { linkToh: 'toh12' });

    const item = insertedItem(editor);
    expect(item.linkToh).toBe('toh12');
    expect(item).not.toHaveProperty('subtype');
  });

  it('criterion 1: a Toh-less passage target carries no linkToh key', () => {
    setMention('p-1', 'passage', 'label', true, { subtype: 'introduction' });

    const item = insertedItem(editor);
    expect(item.subtype).toBe('introduction');
    expect(item).not.toHaveProperty('linkToh');
  });

  it('criterion 4: without a location the item has neither key', () => {
    setMention('w-1', 'work', 'A Work', false);

    const item = insertedItem(editor);
    expect(item).not.toHaveProperty('subtype');
    expect(item).not.toHaveProperty('linkToh');
    expect(item).toMatchObject({ entity: 'w-1', linkType: 'work' });
    expect(item).not.toHaveProperty('isSameWork');
  });

  it('criterion 4: an empty location adds neither key', () => {
    setMention('p-1', 'passage', 'label', true, {});

    const item = insertedItem(editor);
    expect(item).not.toHaveProperty('subtype');
    expect(item).not.toHaveProperty('linkToh');
  });

  it.each(['glossary', 'bibliography', 'folio'])(
    'criterion 4: a %s mention is saved as before',
    (linkType) => {
      setMention('e-1', linkType, 'label', true);

      const item = insertedItem(editor);
      expect(item).toMatchObject({
        entity: 'e-1',
        linkType,
        isSameWork: true,
        displayText: 'label',
      });
      expect(item).not.toHaveProperty('subtype');
      expect(item).not.toHaveProperty('linkToh');
    },
  );
});
