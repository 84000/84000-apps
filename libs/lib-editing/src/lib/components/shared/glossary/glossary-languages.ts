import type { ExtendedTranslationLanguage } from '@eightyfourthousand/data-access';

import { LANGUAGE_LABELS } from '../languages';

/**
 * A language code's label, or the code itself when it has none. A name's
 * label leaves out its script: a Tibetan name is drawn in both Unicode and
 * Wylie, so "Tibetan (Wylie)" would describe only half of it.
 */
export const nameLanguageLabel = (language: string | null): string => {
  if (!language) return 'Unknown language';
  return (
    LANGUAGE_LABELS[language as ExtendedTranslationLanguage]?.language ??
    language
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
