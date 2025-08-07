import { ChevronDown, ListFilter } from 'lucide-react';
import { ReactElement } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../../Popover/Popover';
import { Button } from '../../Button/Button';
import { cn } from '@lib-utils';

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
        <Button
          variant="outline"
          className="ml-auto rounded-full sm:text-sm text-xs"
        >
          <ListFilter />
          {label}
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('max-h-96 overflow-y-scroll', className)}
        align="end"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};
