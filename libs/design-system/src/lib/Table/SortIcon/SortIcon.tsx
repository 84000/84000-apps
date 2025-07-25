import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export const SortIcon = ({
  isSorted,
}: {
  isSorted: false | 'asc' | 'desc';
}) => {
  switch (isSorted) {
    case false:
      return <ArrowUpDown className="text-muted-foreground" />;
    case 'asc':
      return <ArrowUp />;
    case 'desc':
      return <ArrowDown />;
  }
};
