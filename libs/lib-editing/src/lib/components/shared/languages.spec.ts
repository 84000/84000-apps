import { nameLanguageLabel } from './glossary/glossary-languages';
import { TITLE_LANGUAGE_LABELS } from './titles/TitleForm';

describe('language labels', () => {
  it('labels titles by language and script, in the picker order', () => {
    expect(Object.entries(TITLE_LANGUAGE_LABELS)).toEqual([
      ['en', 'English'],
      ['bo', 'Tibetan'],
      ['Bo-Ltn', 'Tibetan (Wylie)'],
      ['Sa-Ltn', 'Sanskrit (Latin)'],
      ['zh', 'Chinese'],
      ['Zh-Ltn', 'Chinese (Pinyin)'],
      ['ja', 'Japanese'],
      ['Mt-Ltn', 'Mongolian (Latin)'],
      ['Pi-Ltn', 'Pali (Latin)'],
    ]);
  });

  it('labels names by their language alone', () => {
    expect(
      [
        'en',
        'bo',
        'Bo-Ltn',
        'Sa-Ltn',
        'zh',
        'Zh-Ltn',
        'ja',
        'Mt-Ltn',
        'Pi-Ltn',
      ].map(nameLanguageLabel),
    ).toEqual([
      'English',
      'Tibetan',
      'Tibetan',
      'Sanskrit',
      'Chinese',
      'Chinese',
      'Japanese',
      'Mongolian',
      'Pali',
    ]);
    expect(nameLanguageLabel(null)).toBe('Unknown language');
    expect(nameLanguageLabel('xx')).toBe('xx');
  });
});
