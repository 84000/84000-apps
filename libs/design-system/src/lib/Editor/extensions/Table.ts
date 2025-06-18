import { Table as TipTapTable } from '@tiptap/extension-table';
import { TableCell as TipTapTableCell } from '@tiptap/extension-table-cell';
import { TableHeader as TipTapTableHeader } from '@tiptap/extension-table-header';
import { TableRow as TipTapTableRow } from '@tiptap/extension-table-row';

export const Table = TipTapTable.configure({
  resizable: true,
});

export const TableCell = TipTapTableCell;
export const TableHeader = TipTapTableHeader;
export const TableRow = TipTapTableRow;
