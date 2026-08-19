import { Editor, Range } from '@tiptap/core';
import { MentionCommandSuggestion } from './MentionCommandSuggestion';
import type { MentionAdvancedPayload } from './Mention';

/**
 * A stub editor recording the chained calls the command makes, plus the storage
 * the command reads. Only `focus`/`deleteRange`/`run` are chained here — enough
 * for this command, which does no other editing.
 */
const createEditor = (openAdvanced?: (p: MentionAdvancedPayload) => void) => {
  const calls: string[] = [];
  const chain = {
    focus: () => {
      calls.push('focus');
      return chain;
    },
    deleteRange: (range: Range) => {
      calls.push(`deleteRange(${range.from},${range.to})`);
      return chain;
    },
    run: () => {
      calls.push('run');
      return true;
    },
  };

  const editor = {
    chain: () => chain,
    storage: { mention: { openAdvanced } },
  } as unknown as Editor;

  return { editor, calls };
};

describe('MentionCommandSuggestion', () => {
  const range: Range = { from: 4, to: 12 };

  it('is unavailable until the advanced overlay registers its callback', () => {
    const { editor } = createEditor();
    expect(MentionCommandSuggestion.isAvailable?.(editor)).toBe(false);

    const { editor: ready } = createEditor(() => undefined);
    expect(MentionCommandSuggestion.isAvailable?.(ready)).toBe(true);
  });

  it('is unavailable when the mention extension is absent entirely', () => {
    const editor = { storage: {} } as unknown as Editor;
    expect(MentionCommandSuggestion.isAvailable?.(editor)).toBe(false);
  });

  it('removes the trigger and opens the picker at its start position', () => {
    const opened: MentionAdvancedPayload[] = [];
    const { editor, calls } = createEditor((p) => opened.push(p));

    MentionCommandSuggestion.command({ editor, range });

    expect(calls).toEqual(['focus', 'deleteRange(4,12)', 'run']);
    // `pos` is the trigger's start, captured before the delete, so the mention
    // lands where the user typed `/`. The query is empty: the text after the
    // slash is the command name, not a search term.
    expect(opened).toEqual([{ pos: 4, query: '' }]);
  });

  it('leaves the document untouched when the picker cannot be opened', () => {
    const { editor, calls } = createEditor();

    MentionCommandSuggestion.command({ editor, range });

    expect(calls).toEqual([]);
  });
});
