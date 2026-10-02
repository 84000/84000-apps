import { Editor, Node } from '@tiptap/core';

import { Mention } from './Mention';
import type { MentionItem } from './Mention.ssr';

// The `@` suggestion's popup list reaches lib-search -> data-access/ssr ->
// next/server, which needs globals jsdom does not provide. A read-only editor
// never opens it, so stub it out.
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

/** A reader editor holding one same-work mention of the given passage. */
const createEditor = (item: Partial<MentionItem>) =>
  new Editor({
    element: document.createElement('div'),
    editable: false,
    extensions: [Doc, Paragraph, TextNode, Mention],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              attrs: {
                items: [
                  {
                    uuid: 'm-1',
                    entity: 'p-1',
                    linkType: 'passage',
                    isSameWork: true,
                    displayText: 'linked',
                    ...item,
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  });

let editor: Editor | undefined;

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

describe('Mention same-work passage links', () => {
  // A section's heading row is typed `<section>Header`, and it lives in the
  // same tab as the section body, not in the translation fallback.
  it.each([
    ['abbreviationsHeader', 'right', 'abbreviations'],
    ['acknowledgmentHeader', 'main', 'front'],
    [undefined, 'main', 'translation'],
  ])('opens a %s passage in %s/%s', (subtype, panel, tab) => {
    editor = createEditor({ subtype });
    const anchor =
      editor.view.dom.querySelector<HTMLAnchorElement>('a.mention-link');
    if (!anchor) throw new Error('mention was not rendered');

    anchor.click();

    const params = new URLSearchParams(window.location.search);
    expect(params.get(panel)).toBe(`open:${tab}:p-1`);
  });
});
