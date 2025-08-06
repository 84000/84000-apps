'use client';

import { cn } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from '@design-system';
import Image from 'next/image';
import { useState } from 'react';
import { CLASSES_FOR_COLOR, NavigationMenuItemProps } from './types';

export const DesktopMenuItem = ({
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
        align="end"
        className={cn(
          'w-full max-w-[1250px] mx-8 p-6 pb-4 rounded-xl shadow-md',
          border,
        )}
      >
        <div>
          <div className="flex gap-12 pb-3">
            <div className="hidden xl:flex relative w-64 h-60">
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
                      <PopoverClose
                        className="text-start"
                        key={`item-${index}`}
                      >
                        <div
                          className="p-2 xl:w-72 w-50 h-full hover:bg-linear-to-r hover:from-transparent hover:to-accent hover:cursor-pointer rounded-lg transition-colors"
                          onClick={() => {
                            router.push(subItem.href);
                          }}
                        >
                          <div className="flex gap-1">
                            <div className="w-6 me-4">
                              <subItem.icon
                                className={cn('size-6 text-ochre')}
                              />
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
                      </PopoverClose>
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

export const DesktopMenu = ({
  items,
}: {
  items: NavigationMenuItemProps[];
}) => (
  <div className="hidden md:flex ml-6">
    {items.map((item) => (
      <DesktopMenuItem key={item.title} item={item} />
    ))}
  </div>
);
