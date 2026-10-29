import type { Extensions } from '@tiptap/core';
import { TableOfContentsIcon } from 'lucide-react';
import { Collaboration } from '@tiptap/extension-collaboration';
import type { UndoManager, XmlFragment } from 'yjs';

import {
  AbbreviationCommand,
  AbbreviationSuggestion,
} from '../editor/extensions/Abbreviation/Abbreviation';
import { MentionCommandSuggestion } from '../editor/extensions/Mention/MentionCommandSuggestion';
import { SlashCommand } from '../editor/extensions/SlashCommand/SlashCommand';
import {
  BulletListSuggestion,
  Heading1Suggestion,
  Heading2Suggestion,
  Heading3Suggestion,
  NumberListSuggestion,
  QuoteSuggestion,
  TextSuggestion,
  getSuggestion,
} from '../editor/extensions/SlashCommand/Suggestions';
import type { CommandSuggestionItem } from '../editor/extensions/SlashCommand/SuggestionList';

import { BoundaryKeymap } from './BoundaryKeymap';
import { buildStackSchemaExtensions } from './stack-extensions';
import type { StackKeyboardDelegate } from './types';

/*
 * The editing half of the stack's extension set: what a live editor adds to
 * the schema. Kept apart from `stack-extensions` so a reader, which only
 * parses and renders, never loads the editor's plugins.
 */

/**
 * The stack's replacement for the translation schema's "Passage" slash item.
 */
const passageSuggestionFor = (
  uuid: string,
  delegate: StackKeyboardDelegate,
): CommandSuggestionItem => ({
  title: 'Passage',
  description: 'Start a new passage.',
  keywords: ['passage'],
  icon: TableOfContentsIcon,
  command: ({ editor, range }) => {
    editor.chain().deleteRange(range).run();
    delegate.splitAtSelection(uuid);
  },
});

export const buildStackEditorExtensions = ({
  uuid,
  fragment,
  undoManager,
  delegate,
}: {
  uuid: string;
  fragment: XmlFragment;
  undoManager: UndoManager;
  delegate: StackKeyboardDelegate;
}): Extensions => [
  ...buildStackSchemaExtensions(),
  // Commands and plugins are kept out of the schema set so they do not affect
  // how a passage document is parsed or statically rendered.
  AbbreviationCommand,
  SlashCommand.configure({
    suggestion: getSuggestion([
      TextSuggestion,
      passageSuggestionFor(uuid, delegate),
      Heading1Suggestion,
      Heading2Suggestion,
      Heading3Suggestion,
      AbbreviationSuggestion,
      MentionCommandSuggestion,
      BulletListSuggestion,
      NumberListSuggestion,
      QuoteSuggestion,
    ]),
  }),
  // The controller's persistent per-passage UndoManager is handed to the
  // undo plugin so history accumulates across mounts (its destroy is
  // neutered — the plugin destroys whatever manager it is given).
  Collaboration.configure({ fragment, yUndoOptions: { undoManager } }),
  BoundaryKeymap.configure({ uuid, delegate }),
];
