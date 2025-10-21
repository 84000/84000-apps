import { BodyItemType, Titles, TohokuCatalogEntry } from '@data-access';
import { TranslationEditorContent } from '../editor';

export type EditorBuilderType = BodyItemType | 'titles';

export type EditorToolsType = 'summarizer' | 'bibliography' | 'glossary';

export type EditorMenuItemType = EditorBuilderType | EditorToolsType;

export interface TranslationRenderer {
  content: TranslationEditorContent;
  name: string;
  className?: string;
}

export interface TitlesRenderer {
  titles: Titles;
  toh?: TohokuCatalogEntry;
}

// some editor keys need custom titles
export const EDITOR_KEY_TO_TITLE: Partial<Record<EditorMenuItemType, string>> =
  {
    endnote: 'end notes',
  };

export const PANEL_NAMES = ['left', 'right', 'main'] as const;
export type PanelName = (typeof PANEL_NAMES)[number];
export type TabName =
  | 'toc'
  | 'summary'
  | 'imprint'
  | 'translation'
  | 'source'
  | 'compare'
  | 'endnotes'
  | 'bibliography'
  | 'glossary'
  | 'abbreviations';

export type PanelState = {
  open: boolean;
  tab?: TabName;
};

export type PanelsState = {
  [key in PanelName]: PanelState;
};
