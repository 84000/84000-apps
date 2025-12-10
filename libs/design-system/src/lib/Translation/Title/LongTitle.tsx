import { TranslationLanguage } from '@data-access';
import { cn } from '@lib-utils';

export const LongTitle = ({
  title,
  language,
}: {
  title: string;
  language: TranslationLanguage;
}) => {
  const LANGAGE_STYLES: { [key in TranslationLanguage]?: string } = {
    'Sa-Ltn': 'italic long-term',
    'Bo-Ltn': 'italic',
    bo: 'font-tibetan',
  };

  const textStyle = LANGAGE_STYLES[language] || '';

  return <div className={cn('py-1.5', textStyle)}>{title}</div>;
};
