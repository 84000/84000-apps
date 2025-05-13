import { Titles as TitlesData, TranslationLanguage } from '@data-access';
import { Title } from './Title';

const LANGUAGE_ORDER: TranslationLanguage[] = ['bo', 'en', 'Bo-Ltn', 'Sa-Ltn'];

export const Titles = ({ titles }: { titles: TitlesData }) => {
  titles.sort(
    (a, b) =>
      LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language),
  );
  return (
    <div className="flex flex-col gap-0">
      {titles.map((title) => (
        <Title
          key={`${title.uuid}-${title.language}`}
          uuid={title.uuid}
          language={title.language}
        >
          {title.title}
        </Title>
      ))}
    </div>
  );
};
