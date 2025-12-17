export const LANGUAGES = ['bo', 'en', 'Bo-Ltn', 'Sa-Ltn'] as const;
export type TranslationLanguage = (typeof LANGUAGES)[number];
export type ExtendedTranslationLanguage =
  | TranslationLanguage
  | 'zh'
  | 'ja'
  | 'Mt-Ltn'
  | 'Pi-Ltn'
  | 'Zh-Ltn';

export const DISPLAY_LANGUAGES = [
  'tibetan',
  'english',
  'wylie',
  'sanskrit',
  'chinese',
  'japanese',
  'mongolian',
  'pali',
  'pinyin',
] as const;
export type DisplayLanguage = (typeof DISPLAY_LANGUAGES)[number];

export const LANGUAGE_MAP: Record<
  ExtendedTranslationLanguage,
  DisplayLanguage
> = {
  bo: 'tibetan',
  en: 'english',
  'Bo-Ltn': 'tibetan',
  'Sa-Ltn': 'sanskrit',
  zh: 'chinese',
  ja: 'japanese',
  'Mt-Ltn': 'mongolian',
  'Pi-Ltn': 'pali',
  'Zh-Ltn': 'pinyin',
};

export const REVERSE_LANGUAGE_MAP: Record<
  DisplayLanguage,
  ExtendedTranslationLanguage
> = {
  tibetan: 'bo',
  english: 'en',
  wylie: 'Bo-Ltn',
  sanskrit: 'Sa-Ltn',
  chinese: 'zh',
  japanese: 'ja',
  mongolian: 'Mt-Ltn',
  pinyin: 'Zh-Ltn',
  pali: 'Pi-Ltn',
};

export const displayLanguageForTranslationLanguage = (
  language: ExtendedTranslationLanguage,
): DisplayLanguage => {
  return LANGUAGE_MAP[language];
};

export const translationLanguageForDisplayLanguage = (
  language: DisplayLanguage,
): ExtendedTranslationLanguage => {
  return REVERSE_LANGUAGE_MAP[language];
};
