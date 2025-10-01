import {
  Titles as TitlesData,
  ExtendedTranslationLanguage,
} from '@data-access';
import { Title } from './Title';

const LANGUAGE_ORDER: ExtendedTranslationLanguage[] = [
  'bo',
  'en',
  'Bo-Ltn',
  'Sa-Ltn',
  'Pi-Ltn',
  'zh',
  'ja',
];

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
