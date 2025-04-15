import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from '@design-system';
import { ComponentProps } from 'react';
import { BookOpen, ChartPieIcon, Edit, Grip, Search } from 'lucide-react';

function AppIcon({
  title,
  href,
  children,
}: { title: string } & ComponentProps<'a'>) {
  return (
    <a href={href} className="size-full aspect-1">
      <div className="flex flex-col items-center justify-center rounded-md gap-2 hover:bg-accent hover:text-accent-foreground p-4">
        {children}
        <span className="text-sm font-medium">{title}</span>
      </div>
    </a>
  );
}

export const AppNavigationMenu = () => (
  <Popover>
    <PopoverTrigger>
      <Button variant="ghost" size="icon" className="size-6" asChild>
        <Grip />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="md:w-[220px] w-[100px] mx-5">
      <div className="grid gap-2 md:grid-cols-2">
        <AppIcon title="Reader" href="/publications/reader">
          <BookOpen />
        </AppIcon>
        <AppIcon title="Editor" href="/publications/editor">
          <Edit />
        </AppIcon>
        <AppIcon title="Search" href="#">
          <Search />
        </AppIcon>
        <AppIcon title="Projects" href="/project">
          <ChartPieIcon />
        </AppIcon>
      </div>
    </PopoverContent>
  </Popover>
);
