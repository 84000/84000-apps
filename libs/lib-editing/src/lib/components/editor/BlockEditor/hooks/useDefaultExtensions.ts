'use client';

import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Document from '../../extensions/Document';
import Heading from '../../extensions/Heading/Heading';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import { SlashCommand } from '../../extensions/SlashCommand/SlashCommand';
import { getSuggestion } from '../../extensions/SlashCommand/Suggestions';
import Link from '../../extensions/Link';
import Placeholder from '../../extensions/Placeholder';
import TextAlign from '../../extensions/TextAlign';
import StarterKit from '../../extensions/StarterKit';
import { Italic } from '../../extensions/Italic';

export const useDefaultExtensions = () => {
  return {
    extensions: [
      Document,
      Heading,
      Image,
      Italic,
      Link,
      Paragraph,
      Placeholder,
      SlashCommand.configure({
        suggestion: getSuggestion(),
      }),
      StarterKit,
      TextAlign,
      Underline,
    ],
  };
};
