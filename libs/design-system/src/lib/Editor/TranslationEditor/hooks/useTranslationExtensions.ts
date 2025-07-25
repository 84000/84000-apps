'use client';

import Underline from '@tiptap/extension-underline';
import { Audio } from '../../extensions/Audio/Audio';
import Heading from '../../extensions/Heading/Heading';
import Image from '../../extensions/Image';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from '../../extensions/Table';
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
import Link from '../../extensions/Link';
import Placeholder from '../../extensions/Placeholder';
import TextAlign from '../../extensions/TextAlign';
import StarterKit from '../../extensions/StarterKit';
import TranslationMetadata from '../../extensions/TranslationMetadata';
import TranslationDocument from '../extensions/TranslationDocument';
import { PassageNode } from '../extensions/Passage';
import { CommandSuggestionItem } from '../../extensions/SlashCommand/SuggestionList';
import { TableOfContentsIcon } from 'lucide-react';
import { LeadingSpace } from '../../extensions/LeadingSpace';
import { Trailer } from '../../extensions/Trailer';
import { LineGroupNode } from '../extensions/LineGroup/LineGroupNode';
import { LineNode } from '../extensions/Line/LineNode';
import { Subscript } from '../../extensions/Subscript';
import { Superscript } from '../../extensions/Superscript';
import { SmallCaps } from '../../extensions/SmallCaps';
import { Italic } from '../../extensions/Italic';
import { Indent } from '../../extensions/Indent';
import { MantraMark } from '../extensions/Mantra/Mantra';
import { EndNoteLinkNode } from '../extensions/EndNoteLink/EndNoteLinkNode';
import { GlossaryInstanceMark } from '../extensions/GlossaryInstanceMark';
import { EndNoteNode } from '../extensions/EndNote/EndNoteNode';
import {
  AbbreviationCell,
  AbbreviationCommand,
  AbbreviationSuggestion,
  HasAbbreviationCell,
} from '../../extensions/Abbreviation/Abbreviation';
import { ParagraphIndent } from '../../extensions/ParagraphIndent';

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

export const useTranslationExtensions = () => {
  const suggestions = [
    TextSuggestion,
    PassageSuggestion,
    Heading1Suggestion,
    Heading2Suggestion,
    Heading3Suggestion,
    AbbreviationSuggestion,
    BulletListSuggestion,
    NumberListSuggestion,
    QuoteSuggestion,
  ];
  return {
    extensions: [
      TranslationDocument,
      Audio,
      AbbreviationCell,
      HasAbbreviationCell,
      AbbreviationCommand,
      EndNoteLinkNode,
      EndNoteNode,
      GlossaryInstanceMark,
      Heading,
      Image,
      Indent,
      Italic,
      LeadingSpace,
      LineGroupNode,
      LineNode,
      Link,
      MantraMark,
      Paragraph,
      ParagraphIndent,
      PassageNode,
      Placeholder,
      SlashCommand.configure({
        suggestion: getSuggestion(suggestions),
      }),
      SmallCaps,
      StarterKit,
      Subscript,
      Superscript,
      Table,
      TableCell,
      TableHeader,
      TableRow,
      Trailer,
      TranslationMetadata,
      TextAlign,
      Underline,
    ],
  };
};
