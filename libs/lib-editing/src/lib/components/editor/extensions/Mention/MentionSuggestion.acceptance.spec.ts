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

describe('mentionSuggestion.command (mock editor)', () => {
  /** Chainable editor stub recording the arguments `setMention` receives. */
  const run = (props: Result) => {
    const setMention = jest.fn().mockReturnThis();
    const chain: Record<string, jest.Mock> = {
      focus: jest.fn().mockReturnThis(),
      deleteRange: jest.fn().mockReturnThis(),
      setMention,
      run: jest.fn(),
    };
    Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
    const editor = { chain: () => chain } as unknown as Editor;
    mentionSuggestion.command?.({
      editor,
      range: { from: 1, to: 2 },
      props,
    });
    return setMention;
  };

  it('criterion 1+2: passes subtype and linkToh as the location', () => {
    const setMention = run(
      result({ subtype: 'endnotes', linkToh: 'toh12', label: 'n.5' }),
    );

    expect(setMention).toHaveBeenCalledTimes(1);
    const [entity, linkType, label, isSameWork, location] =
      setMention.mock.calls[0];
    expect([entity, linkType, label, isSameWork]).toEqual([
      'e-1',
      'passage',
      'n.5',
      true,
    ]);
    expect(location).toEqual({ subtype: 'endnotes', linkToh: 'toh12' });
  });

  it('criterion 1: passes a subtype without a Toh', () => {
    const location = run(result({ subtype: 'introduction' })).mock.calls[0][4];
    expect(location).toMatchObject({ subtype: 'introduction' });
    expect(location?.linkToh).toBeUndefined();
  });

  it.each(['work', 'glossary', 'bibliography', 'folio'] as const)(
    'criterion 4: a %s result carries no subtype or linkToh',
    (linkType) => {
      const call = run(result({ linkType })).mock.calls[0];
      const location = call[4] ?? {};
      expect(location.subtype).toBeUndefined();
      expect(location.linkToh).toBeUndefined();
      expect(call.slice(0, 4)).toEqual([
        'e-1',
        linkType,
        'label',
        linkType !== 'work',
      ]);
    },
  );
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

  it('criterion 1+2: choosing an endnote hit saves subtype and linkToh', () => {
    choose(result({ subtype: 'endnotes', linkToh: 'toh12' }));

    expect(insertedItem()).toMatchObject({
      entity: 'e-1',
      linkType: 'passage',
      isSameWork: true,
      subtype: 'endnotes',
      linkToh: 'toh12',
    });
  });

  it('criterion 4: choosing a work hit saves neither key', () => {
    choose(result({ linkType: 'work' }));

    const item = insertedItem();
    expect(item).not.toHaveProperty('subtype');
    expect(item).not.toHaveProperty('linkToh');
    expect(item).not.toHaveProperty('isSameWork');
  });
});
