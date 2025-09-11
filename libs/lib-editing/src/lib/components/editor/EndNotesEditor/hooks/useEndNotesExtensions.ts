'use client';

import type { XmlFragment } from 'yjs';
import { Collaboration } from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import { EndNotesDocument } from '../extensions/EndNotesDocument';
import { EndNotesPassage } from '../extensions/EndNotesPassage';
import { EndNoteNode } from '../../TranslationEditor/extensions/EndNote/EndNoteNode';
import { STARTER_KIT_CONFIG, StarterKit } from '../../extensions/StarterKit';
import Heading from '../../extensions/Heading/Heading';
import { Italic } from '../../extensions/Italic';
import { GlossaryInstanceNode } from '../../TranslationEditor/extensions/GlossaryInstance/GlossaryInstanceNode';
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

export const useEndNotesExtensions = ({
  fragment,
}: {
  fragment?: XmlFragment;
}) => {
  const suggestions = [
    PassageSuggestion,
    EndNoteSuggestion,
    Heading1Suggestion,
    Heading2Suggestion,
    Heading3Suggestion,
  ];

  const extensions = [
    EndNotesDocument,
    EndNotesPassage,
    EndNoteNode,
    GlossaryInstanceNode,
    Heading,
    Italic,
    Link,
    Paragraph,
    Placeholder,
    SlashCommand.configure({ suggestion: getSuggestion(suggestions) }),
    SmallCaps,
    Subscript,
    Superscript,
    TranslationMetadata,
    Underline,
  ];

  if (fragment) {
    extensions.push(
      StarterKit.configure({
        ...STARTER_KIT_CONFIG,
        trailingNode: { notAfter: ['passage', 'paragraph'] },
        undoRedo: false,
      }),
      Collaboration.configure({ fragment }),
    );
  } else {
    extensions.push(
      StarterKit.configure({
        ...STARTER_KIT_CONFIG,
        trailingNode: { notAfter: ['passage', 'paragraph'] },
      }),
    );
  }

  return { extensions };
};
