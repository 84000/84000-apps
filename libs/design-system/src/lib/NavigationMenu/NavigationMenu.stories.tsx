import { Meta, StoryObj } from '@storybook/nextjs';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './NavigationMenu';
import { ComponentProps } from 'react';
import { cn } from '@lib-utils';
import { BookOpen, ChartPieIcon, Edit, LayoutGrid, Search } from 'lucide-react';

function ListItem({ className, children, ...props }: ComponentProps<'a'>) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a className={cn('aspect-1 p-3 block', className)} {...props}>
          {children}
        </a>
      </NavigationMenuLink>
    </li>
  );
}

const meta: Meta<typeof NavigationMenu> = {
  title: 'Core/NavigationMenu',
  component: NavigationMenu,
  tags: ['autodocs'],
};

type Story = StoryObj<typeof NavigationMenu>;

export const Default: Story = {
  render: () => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            <LayoutGrid />
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid md:w-[120px] w-[60px] gap-2 p-2 md:grid-cols-2">
              <ListItem>
                <BookOpen className="size-full text-foreground" />
              </ListItem>
              <ListItem>
                <Edit className="size-full text-foreground" />
              </ListItem>
              <ListItem>
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
  ),
};

export default meta;
