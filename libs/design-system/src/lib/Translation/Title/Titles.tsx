import {
  Titles as TitlesData,
  TitleType,
  TohokuCatalogEntry,
} from '@data-access';
import { TitlesCard } from './TitlesCard';
import { parseToh } from '@lib-utils';

const BO_PREFIX = '༄༅།\u00a0\u00a0།';
type TitlesVariant = 'english' | 'tibetan' | 'comparison' | 'other';

export const Titles = ({
  titles,
  variant = 'english',
  toh,
}: {
  titles: TitlesData;
  variant?: TitlesVariant;
  toh?: TohokuCatalogEntry;
}) => {
  const titlesByType = titles.reduce(
    (acc, title) => {
      if (!acc[title.type]) {
        acc[title.type] = [];
      }
      acc[title.type].push(title);
      return acc;
    },
    {} as Record<TitleType, TitlesData>,
  );

  let header = '';
  let main = '';
  let footer = '';

  // TODO: support other variants once we have a good understanding of them
  // and the required data is available
  switch (variant) {
    default:
      {
        const mainTitles = titlesByType['mainTitle'] || [];
        header = mainTitles.find((t) => t.language === 'bo')?.title || '';
        if (header) {
          header = `${BO_PREFIX}${header}`;
        }
        main =
          mainTitles.find((t) => t.language === 'en')?.title ||
          mainTitles[0]?.title ||
          '';
        footer = toh ? parseToh(toh) : titlesByType['toh']?.[0]?.title || '';
      }
      break;
  }

  return <TitlesCard header={header} main={main} footer={footer} />;
};
