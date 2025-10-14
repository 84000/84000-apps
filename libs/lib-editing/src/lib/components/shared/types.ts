import { BodyItemType } from '@data-access';
import { TranslationEditorContent } from '../editor';

export type EditorBuilderType = BodyItemType | 'titles';

export type EditorToolsType = 'summarizer' | 'bibliography' | 'glossary';

export type EditorMenuItemType = EditorBuilderType | EditorToolsType;

export interface TranslationRenderer {
  content: TranslationEditorContent;
  name: string;
  className?: string;
}

// some editor keys need custom titles
export const EDITOR_KEY_TO_TITLE: Partial<Record<EditorMenuItemType, string>> =
  {
    endnote: 'end notes',
  };
