import { Editor } from '@tiptap/core';
import { CircleIcon } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import {
  BulletListSuggestion,
  getSuggestion,
  Heading1Suggestion,
  Heading2Suggestion,
  Heading3Suggestion,
  NumberListSuggestion,
  QuoteSuggestion,
  TextSuggestion,
} from './Suggestions';
import { CommandSuggestionItem } from './SuggestionList';

const item = (
  title: string,
  keywords: string[],
  isAvailable?: CommandSuggestionItem['isAvailable'],
): CommandSuggestionItem => ({
  title,
  description: title,
  keywords,
  icon: CircleIcon,
  ...(isAvailable ? { isAvailable } : {}),
  command: () => undefined,
});

// `items` only reads `editor` to pass it to each item's `isAvailable`, so a
// stub with the storage those predicates consult is enough.
const editorWith = (storage: Record<string, unknown>) =>
  ({ storage }) as unknown as Editor;

const listItems = (
  suggestions: CommandSuggestionItem[],
  query: string,
  editor: Editor = editorWith({}),
) => {
  const items = getSuggestion(suggestions).items;
  if (!items) {
    throw new Error('getSuggestion did not provide an items function');
  }
  const result = items({ query, editor });
  if (result instanceof Promise) {
    throw new Error('items is expected to resolve synchronously');
  }
  return result.map((i) => i.title);
};

describe('getSuggestion items', () => {
  const heading = item('Heading', ['heading', 'title']);
  const quote = item('Quote', ['blockquote']);

  it('matches items on any keyword prefix, case-insensitively', () => {
    expect(listItems([heading, quote], 'Head')).toEqual(['Heading']);
    expect(listItems([heading, quote], 'ti')).toEqual(['Heading']);
    expect(listItems([heading, quote], 'block')).toEqual(['Quote']);
  });

  it('matches the words of the title too', () => {
    const numbered = item('Numbered List', ['ordered', 'list']);
    expect(listItems([heading, quote, numbered], 'quote')).toEqual(['Quote']);
    expect(listItems([heading, quote, numbered], 'numbered')).toEqual([
      'Numbered List',
    ]);
    expect(listItems([heading, quote, numbered], 'numbered l')).toEqual([
      'Numbered List',
    ]);
  });

  it('returns every item for an empty query', () => {
    expect(listItems([heading, quote], '')).toEqual(['Heading', 'Quote']);
  });

  it('omits an item whose isAvailable predicate rejects the editor', () => {
    const mention = item('Mention', ['mention'], (editor) =>
      Boolean(
        (editor.storage.mention as { openAdvanced?: unknown } | undefined)
          ?.openAdvanced,
      ),
    );

    expect(listItems([heading, mention], 'mention')).toEqual([]);
    expect(
      listItems(
        [heading, mention],
        'mention',
        editorWith({ mention: { openAdvanced: () => undefined } }),
      ),
    ).toEqual(['Mention']);
  });

  it('keeps items that declare no availability predicate', () => {
    expect(listItems([heading], 'heading')).toEqual(['Heading']);
  });
});

describe('slash menu entries', () => {
  // The suggestion plugin hands each command the range of the typed "/query";
  // every entry has to remove it before changing the block (DEV-855).
  const typed = '/text';
  const range = { from: 1, to: 1 + typed.length };

  const run = (item: CommandSuggestionItem) => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: `<p>${typed}</p>`,
    });
    item.command({ editor, range });
    return editor;
  };

  it.each([
    ['Text', TextSuggestion],
    ['Heading 1', Heading1Suggestion],
    ['Heading 2', Heading2Suggestion],
    ['Heading 3', Heading3Suggestion],
    ['Bullet List', BulletListSuggestion],
    ['Numbered List', NumberListSuggestion],
    ['Quote', QuoteSuggestion],
  ])('%s removes the typed range', (_title, item) => {
    const editor = run(item);
    expect(editor.state.doc.textContent).toBe('');
    editor.destroy();
  });

  it('Text leaves a paragraph in place of the typed range', () => {
    const editor = run(TextSuggestion);
    expect(editor.getJSON().content).toEqual([{ type: 'paragraph' }]);
    editor.destroy();
  });
});
