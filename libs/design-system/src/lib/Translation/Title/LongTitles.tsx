import {
  BO_TITLE_PREFIX,
  ExtendedTranslationLanguage,
  Title,
  Titles,
} from '@data-access';
import { TitlesCard } from './TitlesCard';
import { cn, parseToh } from '@lib-utils';

const LANGUAGE_ORDER: ExtendedTranslationLanguage[] = [
  'bo',
  'Bo-Ltn',
  'en',
  'Sa-Ltn',
  'Pi-Ltn',
  'zh',
  'ja',
];

const DOT = `·` as const;

const sortLanguages = (a: Title, b: Title) =>
  LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language);

export const LongTitles = ({ titles }: { titles: Titles }) => {
  const mainTitles = titles.filter((t) => t.type === 'mainTitle');
  const mainBoTitle = mainTitles.find((t) => t.language === 'bo')?.title || '';
  const mainEnTitle = mainTitles.find((t) => t.language === 'en')?.title || '';
  const mainSaTitle =
    mainTitles.find((t) => t.language === 'Sa-Ltn')?.title || '';

  const longTitles = titles
    .filter((t) => t.type === 'longTitle')
    .sort(sortLanguages);

  const toh = parseToh(titles.find((t) => t.type === 'toh')?.title || '');

  return (
    <div className="py-8 mx-auto max-w-2xl flex flex-col gap-4 w-full">
      <TitlesCard
        header={`${BO_TITLE_PREFIX}${mainBoTitle}`}
        main={mainEnTitle}
        footer={mainSaTitle}
        canEdit={false}
        hasMore={false}
      />
      <div className="h-8" />
      {longTitles.map((t) => {
        const textStyle = ['Sa-Ltn', 'Pi-Ltn'].includes(t.language)
          ? 'italic'
          : '';
        const textSize = ['bo'].includes(t.language) ? 'text-lg' : 'text-sm';
        return (
          <div key={t.uuid} className="px-4">
            <div className={cn('font-serif text-center', textStyle, textSize)}>
              {t.title}
            </div>
          </div>
        );
      })}
      {toh && (
        <div className="pt-8 px-4 font-serif text-center">{`${DOT} ${toh} ${DOT}`}</div>
      )}
    </div>
  );
};
