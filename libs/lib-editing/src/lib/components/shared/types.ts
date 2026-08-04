import {
  BodyItemType,
  Imprint,
  PanelFilter,
  Titles,
} from '@eightyfourthousand/data-access';
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
  | 'abbreviations'
  /** Publish validation findings. Editor-only; readers never see this tab. */
  | 'publishing';

/**
 * Display state for the translation tab body:
 * - `content`: render the translation passages
 * - `unpublished`: work is pre-1.0 and the viewer (a reader) may not view it yet
 * - `empty`: viewer may see content, but there are no body passages
 */
export type TranslationState = 'content' | 'unpublished' | 'empty';

export interface TitlesRenderer {
  titles: Titles;
  imprint?: Imprint;
  name: string;
}

export interface TranslationRenderer {
  content: TranslationEditorContent;
  name: TabName;
  className?: string;
  filter?: PanelFilter;
  panel: PanelName;
  /**
   * Whether more passages exist after the initial `content` window. When
   * `false`, pagination starts with no end cursor so the bottom loading
   * skeleton isn't shown for fully-loaded short texts. Omitted/undefined
   * preserves the legacy behavior (treat as "maybe more").
   */
  hasMoreAfter?: boolean;
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

/**
 * The section a passage belongs to, from its `type`.
 *
 * Each section's heading row carries a `Header` suffix (`endnotesHeader`), and it belongs
 * to the same section as the body it heads. Production also holds a couple of types with
 * trailing whitespace, which would otherwise miss the lookup tables entirely.
 */
export const sectionForPassageType = (type?: string | null): string =>
  (type ?? '').trim().replace(/Header$/, '');

/**
 * Which panel and tab a passage is displayed in.
 *
 * Falls back to the body, which is where most passages live and the least surprising
 * place to land when a type is unrecognized.
 */
export const locationForPassageType = (
  type?: string | null,
): { panel: PanelName; tab: TabName } => {
  const section = sectionForPassageType(type);
  return {
    panel: PANEL_FOR_SECTION[section] ?? 'main',
    tab: TAB_FOR_SECTION[section] ?? 'translation',
  };
};

export type PanelState = {
  open: boolean;
  tab?: TabName;
  hash?: string;
};

/** Character offsets `[start, end)` into a passage's text content to highlight. */
export type HighlightRange = {
  start: number;
  end: number;
};

export type PanelsState = {
  [key in PanelName]: PanelState;
};
