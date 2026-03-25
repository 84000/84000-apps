import { TranslationLanguage } from '@eightyfourthousand/data-access';
import { cn } from '@eightyfourthousand/lib-utils';

export const LongTitle = ({
  title,
  language,
}: {
  title: string;
  language: TranslationLanguage;
}) => {
  const languageStyles: { [key in TranslationLanguage]?: string } = {
    'Sa-Ltn': 'italic long-term',
    'Bo-Ltn': 'italic',
    bo: 'font-tibetan',
  };

  const textStyle = languageStyles[language] || '';

  return <div className={cn('py-1.5', textStyle)}>{title}</div>;
};
