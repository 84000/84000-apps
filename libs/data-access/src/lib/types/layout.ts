import { BodyItemType } from './passage';

export type PanelContentType =
  | BodyItemType
  | 'glossary'
  | 'bibliography'
  | 'source';

// NOTE: default to 'translation' (or 'compare') for content types not listed here
export const TAB_FOR_CONTENT_SECTION: Partial<
  Record<PanelContentType, string>
> = {
  abbreviations: 'abbreviations',
  acknowledgment: 'front',
  bibliography: 'bibliography',
  compare: 'compare',
  endnotes: 'endnotes',
  glossary: 'glossary',
  introduction: 'front',
  source: 'source',
  summary: 'front',
};

// NOTE: default to 'main' for content types not listed here
export const PANEL_FOR_CONTENT_SECTION: Partial<
  Record<PanelContentType, string>
> = {
  abbreviations: 'right',
  bibliography: 'right',
  endnotes: 'right',
  glossary: 'right',
  source: 'main',
};
