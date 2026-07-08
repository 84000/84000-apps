import { removeDiacritics } from '@eightyfourthousand/lib-utils';
import { rankItem, RankingInfo } from '@tanstack/match-sorter-utils';
import { FilterMeta, Row, RowData, Table } from '@tanstack/react-table';
import { XIcon } from 'lucide-react';
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
  const value = table.getState().globalFilter ?? '';
  return (
    <div className="relative min-w-sm md:max-w-md">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => table.setGlobalFilter(event.target.value)}
        className={value ? 'pr-9' : undefined}
        delay={delay}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:cursor-pointer"
          onClick={() => table.setGlobalFilter('')}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
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

/**
 * The best match rank `fuzzyFilterFn` recorded for a row across its columns.
 * Only ranks up to the first passing column are recorded, since global
 * filtering stops evaluating a row's columns once one passes.
 */
export const globalFilterRank = <T extends RowData>(row: Row<T>): number =>
  Math.max(
    0,
    ...Object.values(row.columnFiltersMeta).map(
      (meta) => (meta as { itemRank?: RankingInfo }).itemRank?.rank ?? 0,
    ),
  );
