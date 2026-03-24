export const LANGUAGES = ['bo', 'en', 'Bo-Ltn', 'Sa-Ltn'] as const;

export type TranslationLanguage = (typeof LANGUAGES)[number];

export type ExtendedTranslationLanguage =
  | TranslationLanguage
  | 'zh'
  | 'ja'
  | 'Mt-Ltn'
  | 'Pi-Ltn'
  | 'Zh-Ltn';

export const TITLE_TYPES = [
  'toh',
  'mainTitle',
  'mainTitleOutsideCatalogueSection',
  'longTitle',
  'otherTitle',
  'shortcode',
] as const;

export const BO_TITLE_PREFIX = '༄༅།\u00a0\u00a0།' as const;

export type TitleType = (typeof TITLE_TYPES)[number];

export interface TranslationTitle {
  uuid: string;
  title: string;
  language: ExtendedTranslationLanguage;
  type: TitleType;
}

export type TranslationTitles = TranslationTitle[];

export interface TranslationImprint {
  uuid: string;
  toh: string;
  section?: string;
  restriction?: boolean;
  publishYear?: string;
  tibetanAuthors?: string[];
  isAuthorContested: boolean;
  sourceDescription?: string;
  publisherStatement?: string;
  tibetanTranslators?: string;
  license: {
    link?: string;
    name?: string;
    description?: string;
  };
  mainTitles?: Partial<Record<TranslationLanguage, string>>;
  longTitles?: Partial<Record<TranslationLanguage, string>>;
}
