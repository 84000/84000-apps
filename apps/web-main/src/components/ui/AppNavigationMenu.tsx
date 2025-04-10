import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@design-system';
import { ComponentProps } from 'react';
import { cn } from '@lib-utils';
import { BookOpen, ChartPieIcon, Edit, LayoutGrid, Search } from 'lucide-react';

function ListItem({ className, children, ...props }: ComponentProps<'a'>) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          className={cn(
            'aspect-1 p-3 block flex flex-row justify-center select-none rounded-md leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
            className,
          )}
          {...props}
        >
          {children}
        </a>
      </NavigationMenuLink>
    </li>
  );
}

export const AppNavigationMenu = () => (
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger className={navigationMenuTriggerStyle()}>
          <LayoutGrid />
        </NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="grid md:w-[120px] w-[60px] gap-2 p-2 md:grid-cols-2">
            <ListItem href="/publications/c55aa7e1-31d2-417a-b4d4-918524b3baca/reader">
              <BookOpen className="size-full text-foreground" />
            </ListItem>
            <ListItem href="/publications/c55aa7e1-31d2-417a-b4d4-918524b3baca/editor">
              <Edit className="size-full text-foreground" />
            </ListItem>
            <ListItem href="/project">
              <ChartPieIcon className="size-full text-foreground" />
            </ListItem>
            <ListItem>
              <Search className="size-full text-foreground" />
            </ListItem>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);
