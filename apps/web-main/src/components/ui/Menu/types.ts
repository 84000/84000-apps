import { LucideProps } from 'lucide-react';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

export type BrandColor = 'brick' | 'ochre' | 'slate' | 'navy' | 'emerald';

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
    active: 'text-brick border-brick border-b-2 pt-0.5',
    open: 'text-brick border-brick border-b-1',
    inactive: 'hover:text-brick hover:border-brick',
    text: 'text-brick',
    separator: 'bg-brick',
    footer: 'text-brick',
    border: 'border-brick/50',
  },
  ochre: {
    active: 'text-ochre border-ochre border-b-2 pt-0.5',
    open: 'text-ochre border-ochre border-b-1',
    inactive: 'hover:text-ochre hover:border-ochre',
    text: 'text-ochre',
    separator: 'bg-ochre',
    footer: 'text-ochre',
    border: 'border-ochre/50',
  },
  slate: {
    active: 'text-slate border-slate border-b-2 pt-0.5',
    open: 'text-slate border-slate border-b-1',
    inactive: 'hover:text-slate hover:border-slate',
    text: 'text-slate',
    separator: 'bg-slate',
    footer: 'text-slate',
    border: 'border-slate/50',
  },
  navy: {
    active: 'text-navy border-navy border-b-2 pt-0.5',
    open: 'text-navy border-navy border-b-1',
    inactive: 'hover:text-navy hover:border-navy',
    text: 'text-navy',
    separator: 'bg-navy',
    footer: 'text-navy',
    border: 'border-navy/50',
  },
  emerald: {
    active: 'text-emerald border-emerald border-b-2 pt-0.5',
    open: 'text-emerald border-emerald border-b-1',
    inactive: 'hover:text-emerald hover:border-emerald',
    text: 'text-emerald',
    separator: 'bg-emerald',
    footer: 'text-emerald',
    border: 'border-emerald/50',
  },
};

export type MenuSubItem = {
  header: string;
  body: string;
  href: string;
  isProxy?: boolean;
  icon: ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
  >;
  showOnHomepage?: boolean;
};

export type NavigationMenuItemProps = {
  title: string;
  color: BrandColor;
  href: string;
  hero: {
    header: string;
    body: string;
    image: string;
  };
  sections: {
    header: string;
    items: MenuSubItem[];
  }[];
};
