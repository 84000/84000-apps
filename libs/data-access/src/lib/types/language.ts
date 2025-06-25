export const LANGUAGES = ['bo', 'en', 'Bo-Ltn', 'Sa-Ltn', 'Pi-Ltn'] as const;
export type TranslationLanguage = (typeof LANGUAGES)[number];
export type ExtendedTranslationLanguage = TranslationLanguage | 'zh' | 'ja';
