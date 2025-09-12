'use client';

import StarterKit from '@tiptap/starter-kit';
import {
  BoLtnTitleNode,
  BoTitleNode,
  EnTitleNode,
  MainTitlesNode,
  SaLtnTitleNode,
} from '../extensions/MainTitlesNode';
import { TitlesDocument } from '../extensions/TitlesDocument';
import { Placeholder } from '@tiptap/extensions';
import { cn } from '@lib-utils';
import { TitleMetadata } from '../extensions/TitleMetadata';

const placeholders: Record<string, string> = {
  enTitle: 'English Title (required)',
  boTitle: 'Tibetan Title (required)',
  boLtnTitle: 'Wiley Title (required)',
  saLtnTitle: 'Sanskrit Latin Title (optional)',
};

export const useTitleExtensions = () => {
  return {
    extensions: [
      TitlesDocument,
      MainTitlesNode,
      EnTitleNode,
      BoTitleNode,
      BoLtnTitleNode,
      SaLtnTitleNode,
      StarterKit,
      TitleMetadata,
      Placeholder.configure({
        placeholder: ({ node }) => placeholders[node.type.name] || '',
        emptyEditorClass: cn('is-editor-empty text-gray-400'),
        emptyNodeClass: cn('is-empty text-gray-400'),
        includeChildren: true,
        showOnlyCurrent: false,
      }),
    ],
  };
};
