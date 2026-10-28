import { act, fireEvent, render, screen } from '@testing-library/react';
import { Editor, Node } from '@tiptap/core';

import { Mention } from './Mention';
import type { MentionItem } from './Mention.ssr';
import { MentionHoverContent } from './MentionHoverContent';

jest.mock('./MentionList', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../shared', () => ({
  useNavigation: () => ({ fetchPassage: jest.fn() }),
}));

const Doc = Node.create({ name: 'doc', topNode: true, content: 'block+' });
const Paragraph = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: () => ['p', 0],
});
const TextNode = Node.create({ name: 'text', group: 'inline' });

const createEditor = (item: Partial<MentionItem>) =>
  new Editor({
    element: document.createElement('div'),
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
                items: [{ uuid: 'm-1', entity: 'e-1', ...item }],
              },
            },
          ],
        },
      ],
    },
  });

const storedItem = (editor: Editor): MentionItem => {
  let found: MentionItem | undefined;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'mention') found = node.attrs.items[0];
  });
  return found as MentionItem;
};

let editor: Editor | undefined;

const renderCard = (item: Partial<MentionItem>) => {
  editor = createEditor(item);
  render(
    <MentionHoverContent
      uuid="m-1"
      entityType={item.linkType ?? ''}
      entity="e-1"
      editor={editor}
      requestEditor={async () => null}
      anchor={document.createElement('a')}
      close={jest.fn()}
      setHoverCardEditing={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByTitle('Edit display text'));
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  editor?.destroy();
  editor = undefined;
});

describe('MentionHoverContent', () => {
  it('saves a folio marker’s subtype with its text', () => {
    renderCard({ linkType: 'folio' });

    fireEvent.change(screen.getByLabelText('Marker type'), {
      target: { value: 'bampo' },
    });
    const input = screen.getByPlaceholderText(/Custom label/);
    fireEvent.change(input, { target: { value: '[B1]' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => jest.runAllTimers());

    const item = storedItem(editor as Editor);
    expect(item.subtype).toBe('bampo');
    expect(item.text).toBe('[B1]');
  });

  it('defaults to the stored subtype', () => {
    renderCard({ linkType: 'folio', subtype: 'volume', text: '[V26]' });

    const select = screen.getByLabelText('Marker type') as HTMLSelectElement;
    expect(select.value).toBe('volume');
  });

  it('returns a marker to a plain folio when its text is cleared', () => {
    renderCard({ linkType: 'folio', subtype: 'volume', text: '[V26]' });

    fireEvent.click(screen.getAllByRole('button')[1]);
    act(() => jest.runAllTimers());

    const item = storedItem(editor as Editor);
    expect(item.subtype).toBeUndefined();
    expect(item.text).toBeUndefined();
  });

  it('offers no marker type for other mentions', () => {
    renderCard({ linkType: 'passage', subtype: 'translation' });

    expect(screen.queryByLabelText('Marker type')).toBeNull();
  });
});
