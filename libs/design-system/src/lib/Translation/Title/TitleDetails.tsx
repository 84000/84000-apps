import { Imprint } from '@data-access';
import { LongTitle } from './LongTitle';

const DOT = `·` as const;

export const TitleDetails = ({ imprint }: { imprint: Imprint }) => {
  const { mainTitles, longTitles, toh } = imprint;

  const mainBoLtnTitle = mainTitles?.['Bo-Ltn'] || '';

  const longBoLtnTitle = longTitles?.['Bo-Ltn'] || mainBoLtnTitle;

  const translators =
    imprint?.tibetanTranslators
      ?.split(',')
      ?.map((t) => t.trim())
      .filter((t) => !!t) || [];
  return (
    <div className="pb-4 mx-auto max-2-2xl items-center text-center text-xs font-serif text-foreground/75">
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
              <div key={`translator-wrapper-${idx}`} className="flex gap-x-2">
                <span key={`${translator}-${idx}`}>{translator}</span>
                <span key={`dot-${idx}`}>{DOT}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
