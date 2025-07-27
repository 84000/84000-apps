import { removeDiacritics } from '@lib-utils';
import { rankItem } from '@tanstack/match-sorter-utils';
import { FilterMeta, Row, RowData, Table } from '@tanstack/react-table';
import { DebounceLevel, Input } from '../../Input/Input';

export const FuzzyGlobalFilter = <T extends RowData>({
  table,
  placeholder,
  delay = DebounceLevel.NONE,
}: {
  table: Table<T>;
  placeholder: string;
  delay?: DebounceLevel;
}) => {
  return (
    <Input
      placeholder={placeholder}
      value={table.getState().globalFilter ?? ''}
      onChange={(event) => table.setGlobalFilter(event.target.value)}
      className="min-w-sm md:max-w-md"
      delay={delay}
    />
  );
};

export const fuzzyFilterFn = <T extends RowData>(
  row: Row<T>,
  columnId: string,
  value: string,
  addMeta: (meta: FilterMeta) => void,
) => {
  const rawFilter = removeDiacritics(value);
  const rowValue = row.getValue(columnId);
  const itemRank = rankItem(rowValue, rawFilter, {
    keepDiacritics: false,
  });
  addMeta({ itemRank });
  return itemRank.passed && itemRank.rank > 2;
};
