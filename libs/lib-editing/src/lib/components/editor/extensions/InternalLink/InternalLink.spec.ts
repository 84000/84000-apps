import { Editor, Node } from '@tiptap/core';

import { InternalLink } from './InternalLink';

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
});
const TextNode = Node.create({ name: 'text', group: 'inline' });

/** A reader editor holding one same-work passage link with the given subtype. */
const createEditor = (subtype?: string) =>
  new Editor({
    element: document.createElement('div'),
    editable: false,
    extensions: [Doc, Paragraph, TextNode, InternalLink],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'linked',
              marks: [
                {
                  type: 'internalLink',
                  attrs: {
                    entity: 'p-1',
                    type: 'passage',
                    isSameWork: true,
                    subtype,
                  },
                },
              ],
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

describe('InternalLink same-work passage links', () => {
  // Stored subtypes are passage types: lowercase section names, `Header`
  // rows, and occasionally a stray trailing space.
  it.each([
    ['endnotesHeader', 'right', 'endnotes'],
    ['introduction', 'main', 'front'],
    ['endnotes ', 'right', 'endnotes'],
    ['translation', 'main', 'translation'],
    [undefined, 'main', 'translation'],
  ])('opens a %p passage in %s/%s', (subtype, panel, tab) => {
    editor = createEditor(subtype);
    const link = editor.view.dom.querySelector<HTMLElement>(
      '[type="internalLink"]',
    );
    if (!link) throw new Error('internal link was not rendered');

    link.click();

    const params = new URLSearchParams(window.location.search);
    expect(params.get(panel)).toBe(`open:${tab}:p-1`);
  });
});
