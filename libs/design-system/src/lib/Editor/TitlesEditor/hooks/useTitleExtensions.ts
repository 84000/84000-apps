import StarterKit from '@tiptap/starter-kit';
import {
  BoLtnTitleNode,
  BoTitleNode,
  EnTitleNode,
  SaLtnTitleNode,
} from '../extensions/MainTitlesNode';
import { TitlesDocument } from '../extensions/TitlesDocument';
import { TohNode } from '../extensions/TohsNode';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@lib-utils';

const placeholders: Record<string, string> = {
  toh: 'Tohoku Name',
  enTitle: 'English Title',
  boTitle: 'Tibetan Title',
  boLtnTitle: 'Wiley Title',
  saLtnTitle: 'Sanskrit Latin Title',
};

export const useTitleExtensions = () => {
  return {
    extensions: [
      TitlesDocument,
      // TohsNode,
      TohNode,
      // MainTitlesNode,
      EnTitleNode,
      BoTitleNode,
      BoLtnTitleNode,
      SaLtnTitleNode,
      StarterKit,
      Placeholder.configure({
        placeholder: ({ node }) => placeholders[node.type.name] || '',
        emptyEditorClass: cn('is-editor-empty text-gray-400'),
        emptyNodeClass: cn('is-empty text-gray-400'),
      }),
    ],
  };
};
