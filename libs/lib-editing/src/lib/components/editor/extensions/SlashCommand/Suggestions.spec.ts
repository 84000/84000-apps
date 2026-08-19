import { Editor } from '@tiptap/core';
import { CircleIcon } from 'lucide-react';
import { getSuggestion } from './Suggestions';
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

  it('returns every item for an empty query', () => {
    expect(listItems([heading, quote], '')).toEqual(['Heading', 'Quote']);
  });

  it('omits an item whose isAvailable predicate rejects the editor', () => {
    const mention = item('Mention', ['mention'], (editor) =>
      Boolean((editor.storage.mention as { openAdvanced?: unknown } | undefined)
        ?.openAdvanced),
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
