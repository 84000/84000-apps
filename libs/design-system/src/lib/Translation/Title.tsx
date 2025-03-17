import { ReactNode } from 'react';
import { TranslationLanguage } from '@data-access';
import { H2, H4 } from '../Typography/Typography';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@lib-utils';

const titleVariants = cva('', {
  variants: {
    language: {
      en: '',
      bo: '',
      'Sa-Ltn': 'italic',
      'Bo-Ltn': 'italic',
    },
  },
  defaultVariants: { language: 'en' },
});

export const Title = ({
  children,
  uuid,
  language,
  ...props
}: {
  children: ReactNode;
  uuid?: string;
} & VariantProps<typeof titleVariants>) => {
  const components: { [key in TranslationLanguage]: typeof H2 | typeof H4 } = {
    en: H2,
    bo: H4,
    'Sa-Ltn': H4,
    'Bo-Ltn': H4,
  };

  const Component = (language && components[language]) || H4;

  return (
    <Component className={cn(titleVariants({ language }))} {...props}>
      {children}
    </Component>
  );
};
