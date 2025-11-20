import { BodyItemType, Imprint, PanelFilter, Titles } from '@data-access';
import { TranslationEditorContent } from '../editor';

export type EditorBuilderType = BodyItemType | 'titles';

export type EditorToolsType = 'summarizer' | 'bibliography' | 'glossary';

export type EditorMenuItemType = EditorBuilderType | EditorToolsType;

export const PANEL_NAMES = ['left', 'right', 'main'] as const;
export type PanelName = (typeof PANEL_NAMES)[number];
export type TabName =
  | 'toc'
  | 'front'
  | 'translation'
  | 'source'
  | 'compare'
  | 'endnotes'
  | 'bibliography'
  | 'glossary'
  | 'abbreviations';

export interface TitlesRenderer {
  titles: Titles;
  imprint?: Imprint;
}

export interface TranslationRenderer {
  content: TranslationEditorContent;
  name: string;
  className?: string;
  filter?: PanelFilter;
  panel: PanelName;
}

export type PanelState = {
  open: boolean;
  tab?: TabName;
  hash?: string;
};

export type PanelsState = {
  [key in PanelName]: PanelState;
};
