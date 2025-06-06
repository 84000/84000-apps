'use client';

import Document from '../../extensions/Document';
import Heading from '../../extensions/Heading/Heading';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import { SlashCommand } from '../../extensions/SlashCommand/SlashCommand';
import { getSuggestion } from '../../extensions/SlashCommand/Suggestions';
import Link from '../../extensions/Link';
import Placeholder from '../../extensions/Placeholder';
import TextAlign from '../../extensions/TextAlign';
import Underline from '@tiptap/extension-underline';
import StarterKit from '../../extensions/StarterKit';
import TranslationMetadata from '../../extensions/TranslationMetadata';
import { DragHandle } from '../../extensions/DragHandle/DragHandle';

export const useDefaultExtensions = () => {
  return {
    extensions: [
      Document,
      DragHandle,
      Heading,
      Link,
      Paragraph,
      Placeholder,
      SlashCommand.configure({
        suggestion: getSuggestion(),
      }),
      StarterKit,
      TranslationMetadata,
      TextAlign,
      Underline,
    ],
  };
};
