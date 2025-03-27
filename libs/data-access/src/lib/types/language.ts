export const LANGUAGES = ['bo', 'en', 'Bo-Ltn', 'Sa-Ltn', 'zh'] as const;
export type TranslationLanguage = (typeof LANGUAGES)[number];
