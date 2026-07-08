import { removeDiacritics } from '@eightyfourthousand/lib-utils';
import { rankItem, RankingInfo } from '@tanstack/match-sorter-utils';
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
