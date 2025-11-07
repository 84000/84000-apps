import { BO_TITLE_PREFIX, Imprint, TranslationLanguage } from '@data-access';
import { TitlesCard } from './TitlesCard';
import { cn } from '@lib-utils';
import { Skeleton } from '../../Skeleton/Skeleton';

const DOT = `·` as const;

const LongTitle = ({
  title,
  language,
}: {
  title: string;
  language: TranslationLanguage;
}) => {
  const textStyle = ['Sa-Ltn', 'Bo-Ltn'].includes(language) ? 'italic' : '';
  const textSize = ['bo'].includes(language)
    ? 'text-lg font-semibold'
    : 'text-sm';
  return <div className={cn('py-1.5', textStyle, textSize)}>{title}</div>;
};

export const LongTitles = ({ imprint }: { imprint?: Imprint }) => {
  if (!imprint) {
    return <Skeleton className="h-48 w-full" />;
  }

  const { mainTitles, longTitles, toh } = imprint;

  const mainBoTitle = mainTitles?.bo || '';
  const mainEnTitle = mainTitles?.en || '';
  const mainSaTitle = mainTitles?.['Sa-Ltn'] || '';
  const mainBoLtnTitle = mainTitles?.['Bo-Ltn'] || '';

  const longBoLtnTitle = longTitles?.['Bo-Ltn'] || mainBoLtnTitle;

  const translators =
    imprint?.tibetanTranslators
      ?.split(',')
      ?.map((t) => t.trim())
      .filter((t) => !!t) || [];

  return (
    <div className="pt-8 pb-16 px-4 mx-auto max-w-2xl flex flex-col gap-1 w-full text-center text-sm font-serif">
      <TitlesCard
        header={`${BO_TITLE_PREFIX}${mainBoTitle}`}
        main={mainEnTitle}
        footer={mainSaTitle}
        canEdit={false}
        hasMore={false}
      />
      <div className="h-8" />
      {longTitles?.bo && <LongTitle title={longTitles.bo} language="bo" />}
      {longBoLtnTitle && <LongTitle title={longBoLtnTitle} language="Bo-Ltn" />}
      {longTitles?.en && <LongTitle title={longTitles.en} language="en" />}
      {longTitles?.['Sa-Ltn'] && (
        <LongTitle title={longTitles['Sa-Ltn']} language="Sa-Ltn" />
      )}
      {toh && <div className="pt-8">{`${DOT} ${toh} ${DOT}`}</div>}
      {imprint.sourceDescription && <div>{imprint.sourceDescription}</div>}
      {translators.length > 0 && (
        <>
          <div className="pt-5 pb-1 uppercase text-xs">
            Translated into Tibetan by
          </div>

          <div className="flex gap-x-2 mx-auto flex-wrap justify-center">
            <span>{DOT}</span>
            {translators.map((translator, idx) => (
              <>
                <span key={`${translator}-${idx}`}>{translator}</span>
                <span key={`dot-${idx}`}>{DOT}</span>
              </>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
