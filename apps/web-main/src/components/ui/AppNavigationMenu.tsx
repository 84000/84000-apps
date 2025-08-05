'use client';

import { cn } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import { MENU_ITEMS } from './MenuItems';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@design-system';
import Image from 'next/image';
import { LucideProps } from 'lucide-react';
import { ForwardRefExoticComponent, RefAttributes, useState } from 'react';

type BrandColor = 'brick' | 'ochre' | 'slate' | 'navy' | 'emerald';
const CLASSES_FOR_COLOR: Record<
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

export const AppNavigationMenuItem = ({
  item,
}: {
  item: NavigationMenuItemProps;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { active, open, inactive, text, separator, footer, border } =
    CLASSES_FOR_COLOR[item.color];

  const prefixes = item.sections.flatMap((section) =>
    section.items.map((i) => i.href),
  );
  const isActive = prefixes.some((prefix) => pathname.startsWith(prefix));

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover onOpenChange={(open) => setIsOpen(open)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'hover:cursor-pointer border-b-2 px-3 border-transparent transition-colors',
            isActive ? active : isOpen ? open : inactive,
          )}
        >
          <div className="pt-3 font-semibold leading-6">{item.title}</div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-8xl mx-8 p-6 pb-4 rounded-xl shadow-md', border)}
      >
        <div>
          <div className="flex gap-12 pb-3">
            <div className="relative w-64 h-60">
              <Image
                src={item.hero.image}
                alt={item.hero.header}
                width={288}
                height={232}
                className="m-2 size-full rounded-xl object-cover rounded-xl"
              />
              <div className="absolute inset-0 flex flex-col justify-end p-6 gap-3">
                <p className="text-md font-semibold text-secondary leading-5 drop-shadow-lg">
                  {item.hero.header}
                </p>
                <p className="text-xs text-secondary leading-5 drop-shadow-lg">
                  {item.hero.body}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 h-60">
              {item.sections.map((section, index) => (
                <div key={`section-${index}`} className="h-1/2 w-full">
                  <div className="font-light tracking-wide uppercase text-gray-400 text-lg mb-2">
                    {section.header}
                  </div>
                  <div className="flex gap-2">
                    {section.items.map((subItem, index) => (
                      <div
                        key={`item-${index}`}
                        className="p-2 w-72 hover:bg-linear-to-r hover:from-transparent hover:to-accent hover:cursor-pointer rounded-lg transition-colors"
                        onClick={() => {
                          router.push(subItem.href);
                        }}
                      >
                        <div className="flex gap-1">
                          <div className="w-6 me-4">
                            <subItem.icon className={cn('size-6 text-ochre')} />
                          </div>
                          <div className="flex flex-col">
                            <div className={cn('text-sm pb-1', text)}>
                              {subItem.header}
                            </div>
                            <div className="text-xs text-muted-foreground leading-5">
                              {subItem.body}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-end pl-2 pe-4">
            <Separator className={cn('my-4', separator)} />
            <div
              className={cn('text-end uppercase font-light text-2xl', footer)}
            >
              {item.title}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const AppNavigationMenu = () => (
  <>
    {MENU_ITEMS.map((item) => (
      <AppNavigationMenuItem key={item.title} item={item} />
    ))}
  </>
);
