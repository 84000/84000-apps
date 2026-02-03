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
  endnotes: 'endnotes',
  introduction: 'front',
  summary: 'front',
} as const;

// NOTE: default to 'main' for content types not listed here
export const PANEL_FOR_CONTENT_SECTION: Partial<
  Record<PanelContentType, string>
> = {
  abbreviations: 'right',
  bibliography: 'right',
  endnotes: 'right',
  glossary: 'right',
  source: 'main',
} as const;

// Support different tabs for some content
export const VARIANT_TABS_FOR_TAB: Partial<Record<PanelContentType, string[]>> =
  {
    translation: ['compare'],
  } as const;
