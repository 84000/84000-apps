'use client';

import Heading from '../../extensions/Heading/Heading';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import { SlashCommand } from '../../extensions/SlashCommand/SlashCommand';
import {
  BulletListSuggestion,
  Heading1Suggestion,
  Heading2Suggestion,
  Heading3Suggestion,
  NumberListSuggestion,
  QuoteSuggestion,
  TextSuggestion,
  getSuggestion,
} from '../../extensions/SlashCommand/Suggestions';
import Underline from '@tiptap/extension-underline';
import Link from '../../extensions/Link';
import Placeholder from '../../extensions/Placeholder';
import TextAlign from '../../extensions/TextAlign';
import StarterKit from '../../extensions/StarterKit';
import TranslationMetadata from '../../extensions/TranslationMetadata';
import TranslationDocument from '../extensions/TranslationDocument';
import { PassageNode } from '../extensions/Passage';
import { CommandSuggestionItem } from '../../extensions/SlashCommand/SuggestionList';
import { TableOfContentsIcon } from 'lucide-react';

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
      .refereshLabelsAfter()
      .run();
  },
};

export const useTranslationExtensions = () => {
  const suggestions = [
    TextSuggestion,
    PassageSuggestion,
    Heading1Suggestion,
    Heading2Suggestion,
    Heading3Suggestion,
    BulletListSuggestion,
    NumberListSuggestion,
    QuoteSuggestion,
  ];
  return {
    extensions: [
      TranslationDocument,
      Heading,
      Link,
      Paragraph,
      PassageNode,
      Placeholder,
      SlashCommand.configure({
        suggestion: getSuggestion(suggestions),
      }),
      StarterKit,
      TranslationMetadata,
      TextAlign,
      Underline,
    ],
  };
};
