import { AtSignIcon } from 'lucide-react';
import { CommandSuggestionItem } from '../SlashCommand/SuggestionList';

/**
 * Slash-command entry point for inserting a mention.
 *
 * Rather than reimplementing the picker, this re-enters the `@` flow: it swaps
 * the `/…` trigger for an `@`, and the Mention extension's suggestion plugin
 * takes over from there, showing the same caret-anchored dropdown — debounced
 * search, grouped results, arrow-key navigation, and its own "Advanced search…"
 * button for the cases that need a work/toh field.
 *
 * Two details make the swap reliable. The plugin recomputes its match inside
 * `apply`, so a programmatic `@` triggers it exactly like a typed one; and the
 * default `allowedPrefixes` ([' ']) that let the `/` match in the first place
 * are satisfied by the `@` landing at that same position.
 *
 * Named MentionCommandSuggestion, not MentionSuggestion, to stay distinct from
 * `mentionSuggestion` — the `@`-triggered plugin config in this directory.
 */
export const MentionCommandSuggestion: CommandSuggestionItem = {
  title: 'Mention',
  description: 'Link to a passage, folio, work, glossary term, or source.',
  keywords: ['mention', 'reference', 'cite', 'citation'],
  icon: AtSignIcon,
  // The dropdown this hands off to belongs to the Mention extension. Without it
  // the command would leave a bare `@` and nothing would open, so the item stays
  // out of menus built from an extension list that omits Mention.
  isAvailable: (editor) => !!editor.storage.mention,
  command: ({ editor, range }) => {
    // `insertContentAt(range.from, …)` rather than `insertContent`: the latter
    // inserts at whatever the selection happens to be. In the real flow the
    // caret sits inside the trigger and collapses to `range.from` on delete, so
    // both agree — but naming the position keeps it correct regardless, and
    // leaves the caret after the `@` where the plugin needs it.
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContentAt(range.from, '@')
      .run();
  },
};
