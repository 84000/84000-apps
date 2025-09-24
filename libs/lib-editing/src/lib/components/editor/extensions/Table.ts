import {
  Table as TipTapTable,
  TableCell as TipTapTableCell,
  TableHeader as TipTapTableHeader,
  TableRow as TipTapTableRow,
} from '@tiptap/extension-table';

export const Table = TipTapTable.configure({
  resizable: true,
});

export const TableCell = TipTapTableCell;
export const TableHeader = TipTapTableHeader;
export const TableRow = TipTapTableRow;
