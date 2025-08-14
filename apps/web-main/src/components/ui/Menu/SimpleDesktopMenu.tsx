'use client';

import { cn } from '@lib-utils';
import { usePathname, useRouter } from 'next/navigation';
import { CLASSES_FOR_COLOR, NavigationMenuItemProps } from './types';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@design-system';
import { useState } from 'react';
import { MenuButton } from './MenuButton';
import { ChevronDownIcon } from 'lucide-react';

export const DesktopMenuItem = ({
  item,
}: {
  item: NavigationMenuItemProps;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { active, open, inactive, border, text } =
    CLASSES_FOR_COLOR[item.color];

  const prefixes = item.sections.flatMap((section) =>
    section.items.map((i) => i.href),
  );
  const isActive = prefixes.some((prefix) => pathname.startsWith(prefix));

  const [isOpen, setIsOpen] = useState(false);

  return item.roles?.length ? (
    <Popover onOpenChange={(open) => setIsOpen(open)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'hover:cursor-pointer border-b-1 px-3 border-transparent transition-colors',
            isActive ? active : isOpen ? open : inactive,
          )}
        >
          <span className="flex pt-3 gap-1 font-semibold leading-6">
            {item.title}
            <ChevronDownIcon className="size-3 my-auto" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('mx-8 p-6 pb-4 rounded-xl shadow-md', border)}
      >
        <div className="flex flex-col gap-4">
          {item.sections.map((section, index) => (
            <div key={`section-${index}`}>
              {section.items.map((subItem, subIndex) => (
                <PopoverClose
                  className="text-start"
                  key={`item-${index}-${subIndex}`}
                >
                  <MenuButton subItem={subItem} textStyle={text} />
                </PopoverClose>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  ) : (
    <button
      type="button"
      className={cn(
        'hover:cursor-pointer border-b-1 px-3 border-transparent transition-colors',
        isActive ? active : inactive,
      )}
      onClick={() => router.push(item.href)}
    >
      <div className="pt-3 font-semibold leading-6">{item.title}</div>
    </button>
  );
};

export const SimpleDesktopMenu = ({
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
