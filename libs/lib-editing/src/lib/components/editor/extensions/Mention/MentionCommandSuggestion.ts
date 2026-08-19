import { AtSignIcon } from 'lucide-react';
import { CommandSuggestionItem } from '../SlashCommand/SuggestionList';

/**
 * Slash-command entry point for inserting a mention.
 *
 * Picking an entity needs a focusable search field, which cannot live in the
 * slash menu's suggestion popup (focusing it closes the popup) — the same
 * constraint the `@` dropdown works around with its "Advanced search…" button.
 * So this item does what that button does: it removes the `/…` trigger and
 * hands off to the MentionAdvancedOverlay dialog, which owns its own focus and
 * inserts the chosen mention back at the trigger's position.
 *
 * Named `MentionCommandSuggestion` — not `MentionSuggestion` — to stay clearly
 * distinct from `mentionSuggestion`, the `@`-triggered TipTap suggestion plugin
 * config in this same directory.
 */
export const MentionCommandSuggestion: CommandSuggestionItem = {
  title: 'Mention',
  description: 'Link to a passage, folio, work, glossary term, or source.',
  keywords: ['mention', 'reference', 'cite', 'citation'],
  icon: AtSignIcon,
  // The overlay that hosts the picker is a React component mounted alongside
  // the editor; without it the command would have nothing to open.
  isAvailable: (editor) => !!editor.storage.mention?.openAdvanced,
  command: ({ editor, range }) => {
    const openAdvanced = editor.storage.mention?.openAdvanced;
    if (!openAdvanced) {
      return;
    }

    // Capture the insertion point before deleting the trigger, then hand off.
    const pos = range.from;
    editor.chain().focus().deleteRange(range).run();
    // The typed slash query is the command name ("mention"), not something
    // worth searching for, so the picker opens with an empty query.
    openAdvanced({ pos, query: '' });
  },
};
