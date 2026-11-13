import type { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';

/**
 * A name's language without its script: a Tibetan name is drawn in both
 * Unicode and Wylie, so "Tibetan (Wylie)" would describe only half of it.
 */
export const NAME_LANGUAGE_LABELS: Record<ExtendedTranslationLanguage, string> =
  {
    en: 'English',
    bo: 'Tibetan',
    'Bo-Ltn': 'Tibetan',
    'Sa-Ltn': 'Sanskrit',
    zh: 'Chinese',
    'Zh-Ltn': 'Chinese',
    ja: 'Japanese',
    'Mt-Ltn': 'Mongolian',
    'Pi-Ltn': 'Pali',
  };

/** A language code's label, or the code itself when it has none. */
export const nameLanguageLabel = (language: string | null): string => {
  if (!language) return 'Unknown language';
  return (
    NAME_LANGUAGE_LABELS[language as ExtendedTranslationLanguage] ?? language
  );
};

/**
 * A name's Tibetan script, or null. Only Tibetan names keep script: some
 * other names hold placeholder text in that column.
 */
export const tibetanScript = (name: {
  language: string | null;
  contentTransformed: string | null;
}): string | null =>
  name.language === 'Bo-Ltn' || name.language === 'bo'
    ? name.contentTransformed || null
    : null;
