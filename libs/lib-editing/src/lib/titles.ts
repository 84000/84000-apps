import {
  ExtendedTranslationLanguage,
  TITLE_TYPES,
  Titles,
  TitleType,
} from '@data-access';
import { BlockEditorContent } from './components/editor';

const TYPE_FOR_LANGUAGE: Record<ExtendedTranslationLanguage | 'toh', string> = {
  toh: 'tohTitle',
  bo: 'boTitle',
  en: 'enTitle',
  ja: 'jaTitle',
  zh: 'zhTitle',
  'Bo-Ltn': 'boLtnTitle',
  'Sa-Ltn': 'saLtnTitle',
  'Pi-Ltn': 'piLtnTitle',
};

const TITLES_TYPE_TO_NODE_TYPE: Record<TitleType, string> = {
  toh: 'tohs',
  mainTitle: 'mainTitles',
  mainTitleOutsideCatalogueSection: 'alternateMainTitles',
  longTitle: 'longTitles',
  otherTitle: 'otherTitles',
  shortcode: 'shortCodes',
};

export const titlesToDocument = (titles: Titles): BlockEditorContent => {
  const content: BlockEditorContent = {
    type: 'titles',
    content: [],
  };

  const titlesByType: Partial<Record<TitleType, Titles>> = {};
  titles.forEach((title) => {
    if (!titlesByType[title.type]) {
      titlesByType[title.type] = [];
    }
    titlesByType[title.type]?.push(title);
  });

  // NOTE: the imported list is already in preferred order
  TITLE_TYPES.forEach((type) => {
    const titlesOfType = titlesByType[type];
    if (titlesOfType?.length) {
      const orderedTitles = [
        ...titlesOfType.filter((title) => title.language === 'bo'),
        ...titlesOfType.filter((title) => title.language === 'en'),
        ...titlesOfType.filter((title) => title.language === 'Bo-Ltn'),
        ...titlesOfType.filter((title) => title.language === 'Sa-Ltn'),
        ...titlesOfType.filter((title) => title.language === 'Pi-Ltn'),
        ...titlesOfType.filter((title) => title.language === 'zh'),
        ...titlesOfType.filter((title) => title.language === 'ja'),
      ];

      content.content?.push({
        type: TITLES_TYPE_TO_NODE_TYPE[type],
        content: orderedTitles.map((title) => ({
          type: TYPE_FOR_LANGUAGE[title.language],
          attrs: {
            language: title.language,
            uuid: title.uuid,
            type: title.type,
          },
          content: [
            {
              type: 'text',
              text: title.title,
            },
          ],
        })),
      });
    }
  });

  return content;
};
