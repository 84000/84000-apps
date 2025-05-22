'use client';

import * as Y from 'yjs';
import { cn } from '@lib-utils';
import { Collaboration } from '@tiptap/extension-collaboration';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Document } from '../../extensions/Document';
import Heading from '../../extensions/Heading/Heading';
import Paragraph from '../../extensions/Paragraph/Paragraph';
import { SlashCommand } from '../../extensions/SlashCommand/SlashCommand';
import { getSuggestion } from '../../extensions/SlashCommand/Suggestions';
import { StarterKit } from '../../extensions/StarterKit';
import { DragHandle } from '../../extensions/DragHandle/DragHandle';
import { TranslationMetadata } from '../../extensions/TranslationMetadata';

export const useDefaultExtensions = ({ doc }: { doc: Y.Doc }) => {
  return {
    extensions: [
      Collaboration.configure({ document: doc }),
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
      StarterKit.configure({
        history: false,
      }),
      TranslationMetadata,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
    ],
  };
};
