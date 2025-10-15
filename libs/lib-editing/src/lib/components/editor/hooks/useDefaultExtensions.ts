'use client';

import Image from '@tiptap/extension-image';
import Document from '../extensions/Document';
import Heading from '../extensions/Heading/Heading';
import Paragraph from '../extensions/Paragraph/Paragraph';
import { SlashCommand } from '../extensions/SlashCommand/SlashCommand';
import { getSuggestion } from '../extensions/SlashCommand/Suggestions';
import { Link } from '../extensions/Link';
import Placeholder from '../extensions/Placeholder';
import TextAlign from '../extensions/TextAlign';
import StarterKit from '../extensions/StarterKit';
import { Italic } from '../extensions/Italic';
import { Underline } from '../extensions/Underline';
import { Bold } from '../extensions/Bold';
import { List } from '../extensions/List';

export const useDefaultExtensions = () => {
  return {
    extensions: [
      Bold,
      Document,
      Heading,
      Image,
      Italic,
      Link,
      List,
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
