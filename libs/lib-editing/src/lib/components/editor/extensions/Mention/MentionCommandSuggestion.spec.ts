import { Editor, Range } from '@tiptap/core';
import { MentionCommandSuggestion } from './MentionCommandSuggestion';

/** A stub editor recording the chained calls the command makes. */
const createEditor = (storage: Record<string, unknown> = { mention: {} }) => {
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
    insertContentAt: (pos: number, content: string) => {
      calls.push(`insertContentAt(${pos},${content})`);
      return chain;
    },
    run: () => {
      calls.push('run');
      return true;
    },
  };

  return { editor: { chain: () => chain, storage } as unknown as Editor, calls };
};

describe('MentionCommandSuggestion', () => {
  const range: Range = { from: 4, to: 12 };

  it('is available when the Mention extension is loaded', () => {
    const { editor } = createEditor();
    expect(MentionCommandSuggestion.isAvailable?.(editor)).toBe(true);
  });

  it('is unavailable when the Mention extension is absent', () => {
    const { editor } = createEditor({});
    expect(MentionCommandSuggestion.isAvailable?.(editor)).toBe(false);
  });

  it('swaps the slash trigger for an `@` so the mention dropdown takes over', () => {
    const { editor, calls } = createEditor();

    MentionCommandSuggestion.command({ editor, range });

    // Deleting the trigger first puts the `@` where the `/` was, which is a
    // position the suggestion plugin's allowedPrefixes already accepted.
    expect(calls).toEqual([
      'focus',
      'deleteRange(4,12)',
      'insertContentAt(4,@)',
      'run',
    ]);
  });
});
