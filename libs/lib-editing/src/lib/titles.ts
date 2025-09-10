import { Titles } from '@data-access';
import { BlockEditorContent } from './components/editor';

const TYPE_FOR_LANGUAGE = {
  bo: 'boTitle',
  en: 'enTitle',
  'Bo-Ltn': 'boLtnTitle',
  'Sa-Ltn': 'saLtnTitle',
};

export const titlesToDocument = (titles: Titles): BlockEditorContent => {
  const orderedTitles = [
    ...titles.filter((title) => title.language === 'bo'),
    ...titles.filter((title) => title.language === 'en'),
    ...titles.filter((title) => title.language === 'Bo-Ltn'),
    ...titles.filter((title) => title.language === 'Sa-Ltn'),
  ];

  return {
    type: 'titles',
    content: [
      {
        type: 'mainTitles',
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
      },
    ],
  };
};
