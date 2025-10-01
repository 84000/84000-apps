import { ReactNode } from 'react';
import { ExtendedTranslationLanguage } from '@data-access';
import { H2, H3, H4 } from '../../Typography/Typography';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@lib-utils';

export const TITLE_VARIANT_STYLES = {
  en: '',
  bo: 'my-1',
  ja: 'my-1 italic font-light text-muted-foreground',
  zh: 'my-1 italic font-light text-muted-foreground',
  'Sa-Ltn': 'my-1 italic font-light text-muted-foreground',
  'Bo-Ltn': 'my-1 italic font-light text-muted-foreground',
  'Pi-Ltn': 'my-1 italic font-light text-muted-foreground',
};

const titleVariants = cva('', {
  variants: {
    language: TITLE_VARIANT_STYLES,
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
  const components: {
    [key in ExtendedTranslationLanguage]: typeof H2 | typeof H4;
  } = {
    en: H2,
    bo: H3,
    ja: H4,
    zh: H4,
    'Sa-Ltn': H4,
    'Bo-Ltn': H4,
    'Pi-Ltn': H4,
  };

  const Component = (language && components[language]) || H4;

  return (
    <Component className={cn(titleVariants({ language }))} {...props}>
      {children}
    </Component>
  );
};
