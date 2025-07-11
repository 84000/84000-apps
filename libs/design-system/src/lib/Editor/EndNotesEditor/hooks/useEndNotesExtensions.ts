'use client';

import Underline from '@tiptap/extension-underline';
import { EndNotesDocument } from '../extensions/EndNotesDocument';
import { EndNotesPassage } from '../extensions/EndNotesPassage';
import { EndNoteNode } from '../../TranslationEditor/extensions/EndNote/EndNoteNode';
import StarterKit from '../../extensions/StarterKit';
import Heading from '../../extensions/Heading/Heading';
import { Italic } from '../../extensions/Italic';
import { GlossaryInstanceMark } from '../../TranslationEditor/extensions/GlossaryInstanceMark';
import Link from '../../extensions/Link';
import { SmallCaps } from '../../extensions/SmallCaps';
import { Subscript } from '../../extensions/Subscript';
import { Superscript } from '../../extensions/Superscript';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import TranslationMetadata from '../../extensions/TranslationMetadata';
import { CommandSuggestionItem } from '../../extensions/SlashCommand/SuggestionList';
import { LetterTextIcon, TableOfContentsIcon } from 'lucide-react';
import {
  Heading1Suggestion,
  Heading2Suggestion,
  Heading3Suggestion,
  getSuggestion,
} from '../../extensions/SlashCommand/Suggestions';
import { SlashCommand } from '../../extensions/SlashCommand/SlashCommand';
import Placeholder from '../../extensions/Placeholder';

const PassageSuggestion: CommandSuggestionItem = {
  title: 'Passage',
  description: 'Start a new passage.',
  keywords: ['passage'],
  icon: TableOfContentsIcon,
  command: ({ editor, range }) => {
    editor
      .chain()
      .deleteRange(range)
      .selectParentNode()
      .deleteCurrentNode()
      .splitPassage()
      .refreshLabelsAfter()
      .run();
  },
};

export const EndNoteSuggestion: CommandSuggestionItem = {
  title: 'End Note',
  description: 'Just start typing',
  keywords: ['text', 'endnote', 'p', 'paragraph', 'note', 'end'],
  icon: LetterTextIcon,
  command: ({ editor }) => {
    editor.chain().focus().toggleNode('endNote', 'endNote').run();
  },
};

export const useEndNotesExtensions = () => {
  const suggestions = [
    PassageSuggestion,
    EndNoteSuggestion,
    Heading1Suggestion,
    Heading2Suggestion,
    Heading3Suggestion,
  ];

  return {
    extensions: [
      EndNotesDocument,
      EndNotesPassage,
      EndNoteNode,
      GlossaryInstanceMark,
      Heading,
      Italic,
      Link,
      Paragraph,
      Placeholder,
      SlashCommand.configure({ suggestion: getSuggestion(suggestions) }),
      SmallCaps,
      StarterKit,
      Subscript,
      Superscript,
      TranslationMetadata,
      Underline,
    ],
  };
};
