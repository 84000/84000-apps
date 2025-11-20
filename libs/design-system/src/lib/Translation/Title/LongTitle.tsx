import { TranslationLanguage } from '@data-access';
import { cn } from '@lib-utils';

export const LongTitle = ({
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
