import { Input } from '@design-system';
import { RowData, Table } from '@tanstack/react-table';

export const FuzzyGlobalFilter = <T extends RowData>({
  table,
  placeholder,
}: {
  table: Table<T>;
  placeholder: string;
}) => {
  return (
    <Input
      placeholder={placeholder}
      value={table.getState().globalFilter ?? ''}
      onChange={(event) => table.setGlobalFilter(event.target.value)}
      className="max-w-sm"
    />
  );
};
