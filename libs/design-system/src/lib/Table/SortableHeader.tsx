import { Column } from '@tanstack/react-table';
import { SortIcon } from './SortIcon';
import { cn } from '@lib-utils';
import { Button } from '../Button/Button';

export const SortableHeader = <T extends object>({
  column,
  name,
  className,
}: {
  column: Column<T, unknown>;
  name: string;
  className?: string;
}) => {
  const isSorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className={cn(
        'px-0 hover:bg-transparent hover:cursor-pointer',
        className,
      )}
    >
      {name}
      <SortIcon isSorted={isSorted} />
    </Button>
  );
};
