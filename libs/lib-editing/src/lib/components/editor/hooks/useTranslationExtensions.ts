'use client';

import type { XmlFragment } from 'yjs';
import { Collaboration } from '@tiptap/extension-collaboration';
import { Audio } from '../extensions/Audio/Audio';
import Heading from '../extensions/Heading/Heading';
import Image from '../extensions/Image';
import Paragraph from '../extensions/Paragraph/Paragraph';
import { TableKit } from '../extensions/Table';
import { SlashCommand } from '../extensions/SlashCommand/SlashCommand';
import {
  BulletListSuggestion,
  Heading1Suggestion,
  Heading2Suggestion,
  Heading3Suggestion,
  NumberListSuggestion,
  QuoteSuggestion,
  TextSuggestion,
  getSuggestion,
} from '../extensions/SlashCommand/Suggestions';
import { Link } from '../extensions/Link';
import Placeholder from '../extensions/Placeholder';
import TextAlign from '../extensions/TextAlign';
import { STARTER_KIT_CONFIG, StarterKit } from '../extensions/StarterKit';
import TranslationMetadata from '../extensions/TranslationMetadata';
import TranslationDocument from '../extensions/TranslationDocument';
import { PassageNode } from '../extensions/Passage';
import { CommandSuggestionItem } from '../extensions/SlashCommand/SuggestionList';
import { TableOfContentsIcon } from 'lucide-react';
import { LeadingSpace } from '../extensions/LeadingSpace';
import { Trailer } from '../extensions/Trailer';
import { LineGroupNode } from '../extensions/LineGroup/LineGroupNode';
import { LineNode } from '../extensions/Line/LineNode';
import { Subscript } from '../extensions/Subscript';
import { Superscript } from '../extensions/Superscript';
import { SmallCaps } from '../extensions/SmallCaps';
import { Italic } from '../extensions/Italic';
import { Indent } from '../extensions/Indent';
import { InternalLink } from '../extensions/InternalLink';
import { MantraMark } from '../extensions/Mantra/Mantra';
import { EndNoteLinkNode } from '../extensions/EndNoteLink/EndNoteLinkNode';
import { GlossaryInstanceNode } from '../extensions/GlossaryInstance/GlossaryInstanceNode';
import {
  Abbreviation,
  AbbreviationCommand,
  AbbreviationSuggestion,
  HasAbbreviation,
} from '../extensions/Abbreviation/Abbreviation';
import { ParagraphIndent } from '../extensions/ParagraphIndent';
import { TranslationEditorContent } from '../TranslationEditor';
import { Bold } from '../extensions/Bold';
import { List } from '../extensions/List';
import { Underline } from '../extensions/Underline';
import { GlobalConfig } from '../extensions/GlobalConfig';

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

export const useTranslationExtensions = ({
  fragment,
  fetchEndNote,
}: {
  fragment?: XmlFragment;
  fetchEndNote?: (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;
}) => {
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
  const extensions = [
    TranslationDocument,
    Audio,
    Abbreviation,
    HasAbbreviation,
    AbbreviationCommand,
    Bold,
    EndNoteLinkNode.configure({
      fetch: fetchEndNote,
    }),
    GlobalConfig,
    GlossaryInstanceNode,
    Heading,
    Image,
    Indent,
    InternalLink,
    Italic,
    LeadingSpace,
    LineGroupNode,
    LineNode,
    Link,
    List,
    MantraMark,
    Paragraph,
    ParagraphIndent,
    PassageNode,
    Placeholder,
    SlashCommand.configure({
      suggestion: getSuggestion(suggestions),
    }),
    SmallCaps,
    Subscript,
    Superscript,
    TableKit,
    Trailer,
    TranslationMetadata,
    TextAlign,
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
