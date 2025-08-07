'use client';

import { cn } from '@lib-utils';
import { useRouter } from 'next/navigation';
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

export const MobileMenuItem = ({ item }: { item: NavigationMenuItemProps }) => {
  const router = useRouter();

  return (
    <AccordionItem value={item.title} className="border-none">
      <AccordionTrigger className="hover:no-underline">
        {item.title}
      </AccordionTrigger>
      <AccordionContent>
        <Accordion type="single" collapsible className="pl-2">
          {item.sections.map((section, index) => (
            <AccordionItem
              key={`section-${index}`}
              value={`${item.title}-section-${index}`}
              className="border-none"
            >
              <AccordionTrigger className="font-light tracking-wide uppercase text-gray-400 text-sm hover:no-underline">
                {section.header}
              </AccordionTrigger>
              <AccordionContent>
                {section.items.map((subItem, index) => (
                  <SheetClose
                    className="w-full text-start"
                    key={`subitem-${index}`}
                    onClick={() => {
                      router.push(subItem.href);
                    }}
                  >
                    <div className="p-2 hover:bg-linear-to-r hover:from-transparent hover:to-accent hover:cursor-pointer rounded-lg transition-colors">
                      <div className="flex gap-1">
                        <div className="w-6 me-4">
                          <subItem.icon className={cn('size-6 text-ochre')} />
                        </div>
                        <div className="flex flex-col">
                          <div className="text-sm pb-1">{subItem.header}</div>
                          <div className="text-xs text-muted-foreground leading-5">
                            {subItem.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  </SheetClose>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  );
};

export const MobileMenu = ({ items }: { items: NavigationMenuItemProps[] }) => {
  return (
    <div className="md:hidden">
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
            <Accordion type="single" collapsible className="px-4">
              {items.map((item) => (
                <MobileMenuItem key={item.title} item={item} />
              ))}
            </Accordion>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};
