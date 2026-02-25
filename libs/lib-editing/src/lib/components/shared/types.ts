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
  name: string;
}

export interface TranslationRenderer {
  content: TranslationEditorContent;
  name: string;
  className?: string;
  filter?: PanelFilter;
  panel: PanelName;
}

export const TAB_FOR_SECTION: Record<string, TabName> = {
  abbreviations: 'abbreviations',
  acknowledgment: 'front',
  appendix: 'translation',
  bibliography: 'bibliography',
  colophon: 'translation',
  endnotes: 'endnotes',
  glossary: 'glossary',
  homage: 'translation',
  imprint: 'front',
  introduction: 'front',
  prelude: 'translation',
  prologue: 'translation',
  summary: 'front',
  translation: 'translation',
};

export const PANEL_FOR_SECTION: Record<string, PanelName> = {
  abbreviations: 'right',
  acknowledgment: 'main',
  appendix: 'main',
  bibliography: 'right',
  colophon: 'main',
  endnotes: 'right',
  glossary: 'right',
  homage: 'main',
  imprint: 'main',
  introduction: 'main',
  prelude: 'main',
  prologue: 'main',
  summary: 'main',
  translation: 'main',
};

export type PanelState = {
  open: boolean;
  tab?: TabName;
  hash?: string;
};

export type PanelsState = {
  [key in PanelName]: PanelState;
};
