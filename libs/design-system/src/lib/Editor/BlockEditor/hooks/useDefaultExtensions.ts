'use client';

import { Document } from '../../extensions/Document';
import Heading from '../../extensions/Heading/Heading';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import { SlashCommand } from '../../extensions/SlashCommand/SlashCommand';
import { getSuggestion } from '../../extensions/SlashCommand/Suggestions';
import { cn } from '@lib-utils';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { StarterKit } from '../../extensions/StarterKit';
import { DragHandle } from '../../extensions/DragHandle/DragHandle';
import { TranslationMetadata } from '../../extensions/TranslationMetadata';

export const useDefaultExtensions = () => {
  return {
    extensions: [
      Document,
      DragHandle.configure({
        draghandleWidth: 25,
      }),
      Heading,
      Link.configure({
        HTMLAttributes: {
          class: cn(
            '!text-foreground underline underline-offset-[3px] transition-colors cursor-pointer',
          ),
        },
        openOnClick: false,
      }),
      Paragraph,
      Placeholder.configure({
        placeholder: 'Type / for commands...',
        emptyEditorClass: cn('is-editor-empty text-gray-400'),
        emptyNodeClass: cn('is-empty text-gray-400'),
      }),
      SlashCommand.configure({
        suggestion: getSuggestion(),
      }),
      StarterKit,
      TranslationMetadata,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
    ],
  };
};
