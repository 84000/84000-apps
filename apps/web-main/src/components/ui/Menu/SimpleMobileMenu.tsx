'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  MainLogo,
  ScrollArea,
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@design-system';
import { MenuIcon } from 'lucide-react';
import { NavigationMenuItemProps } from './types';
import { MenuButton } from './MenuButton';
import { usePathname } from 'next/navigation';
import { cn } from '@lib-utils';

export const MobileMenuItem = ({ item }: { item: NavigationMenuItemProps }) => {
  const pathname = usePathname();
  const prefixes = item.sections.flatMap((section) =>
    section.items.map((i) => i.href),
  );
  const isActive = prefixes.some((prefix) => pathname.startsWith(prefix));

  return (
    <Accordion
      defaultValue={item.title}
      type="single"
      collapsible
      className="px-4 py-1"
    >
      <AccordionItem value={item.title} className="border-none">
        <AccordionTrigger
          className={cn(
            'pt-3 font-semibold text-md pt-3 leading-6 hover:no-underline',
            isActive ? 'font-bold' : 'font-normal',
          )}
        >
          {item.title}
        </AccordionTrigger>
        <AccordionContent>
          {item.sections.map((section, index) => (
            <div key={`section-${index}`} className="pl-2">
              {section.items.map((subItem, subIndex) => (
                <SheetClose
                  className="w-full text-start"
                  key={`subitem-${index}-${subIndex}`}
                >
                  <MenuButton subItem={subItem} />
                </SheetClose>
              ))}
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export const SimpleMobileMenu = ({
  items,
}: {
  items: NavigationMenuItemProps[];
}) => {
  return (
    <div className="lg:hidden">
      <Sheet>
        <SheetTrigger className="h-full">
          <MenuIcon />
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle className="hidden">Main Navigation</SheetTitle>
            <MainLogo width={80} />
          </SheetHeader>
          <ScrollArea className="h-full overflow-y-auto">
            {items.map((item) => (
              <MobileMenuItem key={item.title} item={item} />
            ))}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};
