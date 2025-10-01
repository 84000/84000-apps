'use client';

import StarterKit from '@tiptap/starter-kit';
import {
  AlternateTitlesNode,
  LongTitlesNode,
  MainTitlesNode,
  OtherTitlesNode,
  ShortCodesNode,
  TohsNode,
} from '../extensions/TitlesNode';
import { TitlesDocument } from '../extensions/TitlesDocument';
import { Placeholder } from '@tiptap/extensions';
import { cn } from '@lib-utils';
import { TitleMetadata } from '../extensions/TitleMetadata';
import {
  BoLtnTitleNode,
  BoTitleNode,
  EnTitleNode,
  JaTitleNode,
  PiLtnTitleNode,
  SaLtnTitleNode,
  TohTitleNode,
  ZhTitleNode,
} from '../extensions/TitleNode';

const placeholders: Record<string, string> = {
  tohTitle: 'Toh Number',
  enTitle: 'English Title',
  boTitle: 'Tibetan Title',
  boLtnTitle: 'Wiley Title',
  saLtnTitle: 'Sanskrit Latin Title',
  piLtnTitle: 'Pali Latin Title',
  jaTitle: 'Japanese Title',
  zhTitle: 'Chinese Title',
};

export const useTitleExtensions = () => {
  return {
    extensions: [
      TitlesDocument,
      AlternateTitlesNode,
      MainTitlesNode,
      EnTitleNode,
      BoTitleNode,
      BoLtnTitleNode,
      JaTitleNode,
      LongTitlesNode,
      OtherTitlesNode,
      PiLtnTitleNode,
      SaLtnTitleNode,
      ShortCodesNode,
      StarterKit,
      TitleMetadata,
      TohTitleNode,
      TohsNode,
      ZhTitleNode,
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
