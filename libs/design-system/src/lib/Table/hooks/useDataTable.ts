'use client';

import {
  Cell,
  ColumnDef,
  PaginationState,
  RowData,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { fuzzyFilterFn } from '../FuzzyGlobalFilter/FuzzyGlobalFilter';

export type DataTableRow = RowData & { uuid: string };
export type DataTableColumn<T extends DataTableRow> = ColumnDef<T> & {
  className?: string;
  onCellClick?: (row: Cell<T, unknown>) => void;
};

export const useDataTable = <T extends DataTableRow>({
  data,
  columns,
  visibility: visibilityInput = {},
  sorting: sortingInput = [],
  pagination: paginationInput = { pageIndex: 0, pageSize: 12 },
  globalFilter: globalFilterInput = '',
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  visibility?: VisibilityState;
  sorting?: SortingState;
  pagination?: PaginationState;
  globalFilter?: string;
}) => {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(visibilityInput);
  const [globalFilter, setGlobalFilter] = useState(globalFilterInput);
  const [sorting, setSorting] = useState<SortingState>(sortingInput);
  const [pagination, setPagination] = useState(paginationInput);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      rowSelection,
      pagination,
    },
    getRowId: (row) => row.uuid,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: fuzzyFilterFn,
  });

  return { table };
};
