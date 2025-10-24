import { BodyItemType, Imprint, Titles } from '@data-access';
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
  imprint?: Imprint;
}

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
