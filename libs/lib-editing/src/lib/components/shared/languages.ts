import type { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';

/**
 * Each language's label for editors, and the script it is written in when
 * that is not the language's own. Ordered by how much of the corpus each
 * accounts for.
 */
export const LANGUAGE_LABELS: Record<
  ExtendedTranslationLanguage,
  { language: string; script?: string }
> = {
  en: { language: 'English' },
  bo: { language: 'Tibetan' },
  'Bo-Ltn': { language: 'Tibetan', script: 'Wylie' },
  'Sa-Ltn': { language: 'Sanskrit', script: 'Latin' },
  zh: { language: 'Chinese' },
  'Zh-Ltn': { language: 'Chinese', script: 'Pinyin' },
  ja: { language: 'Japanese' },
  'Mt-Ltn': { language: 'Mongolian', script: 'Latin' },
  'Pi-Ltn': { language: 'Pali', script: 'Latin' },
};
