import { LucideProps } from 'lucide-react';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

type BrandColor = 'brick' | 'ochre' | 'slate' | 'navy' | 'emerald';

export const CLASSES_FOR_COLOR: Record<
  BrandColor,
  {
    active: string;
    open: string;
    inactive: string;
    text: string;
    separator: string;
    footer: string;
    border: string;
  }
> = {
  brick: {
    active: 'text-brick border-brick border-b-4',
    open: 'text-brick border-brick border-b-2',
    inactive: 'hover:text-brick hover:border-brick',
    text: 'text-brick',
    separator: 'bg-brick-200',
    footer: 'text-brick-200',
    border: 'border-brick-50',
  },
  ochre: {
    active: 'text-ochre border-ochre border-b-4',
    open: 'text-ochre border-ochre border-b-2',
    inactive: 'hover:text-ochre hover:border-ochre',
    text: 'text-ochre',
    separator: 'bg-ochre-200',
    footer: 'text-ochre-200',
    border: 'border-ochre-50',
  },
  slate: {
    active: 'text-slate border-slate border-b-4',
    open: 'text-slate border-slate border-b-2',
    inactive: 'hover:text-slate hover:border-slate',
    text: 'text-slate',
    separator: 'bg-slate-200',
    footer: 'text-slate-200',
    border: 'border-slate-50',
  },
  navy: {
    active: 'text-navy border-navy border-b-4',
    open: 'text-navy border-navy border-b-2',
    inactive: 'hover:text-navy hover:border-navy',
    text: 'text-navy',
    separator: 'bg-navy-200',
    footer: 'text-navy-200',
    border: 'border-navy-50',
  },
  emerald: {
    active: 'text-emerald border-emerald border-b-4',
    open: 'text-emerald border-emerald border-b-2',
    inactive: 'hover:text-emerald hover:border-emerald',
    text: 'text-emerald',
    separator: 'bg-emerald-200',
    footer: 'text-emerald-200',
    border: 'border-emerald-50',
  },
};

export type NavigationMenuItemProps = {
  title: string;
  color: BrandColor;
  href: string;
  isAdmin?: boolean;
  hero: {
    header: string;
    body: string;
    image: string;
  };
  sections: {
    header: string;
    items: {
      header: string;
      body: string;
      href: string;
      icon: ForwardRefExoticComponent<
        Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
      >;
    }[];
  }[];
};
