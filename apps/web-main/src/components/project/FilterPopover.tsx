import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@design-system';
import { ChevronDown, ListFilter } from 'lucide-react';
import { ReactElement } from 'react';

export const FilterPopover = ({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactElement;
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="ml-auto rounded-full">
          <ListFilter />
          {label}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={className} align="end">
        {children}
      </PopoverContent>
    </Popover>
  );
};
