'use client';

import {
  Cell,
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
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
import { useEffect, useState } from 'react';
import { fuzzyFilterFn } from '../FuzzyGlobalFilter/FuzzyGlobalFilter';

export type DataTableRow = RowData & { uuid: string };
export type DataTableColumn<T extends DataTableRow> = ColumnDef<T> & {
  className?: string;
  onCellClick?: (row: Cell<T, unknown>) => void;
};
export type DataTableState = {
  globalFilter: string;
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnSizing: ColumnSizingState;
};

export const useDataTable = <T extends DataTableRow>({
  data,
  columns,
  visibility: visibilityInput = {},
  sorting: sortingInput = [],
  pagination: paginationInput = { pageIndex: 0, pageSize: 12 },
  globalFilter: globalFilterInput = '',
  columnFilters: columnFiltersInput = [],
  columnSizing: columnSizingInput = {},
  onStateChange,
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  visibility?: VisibilityState;
  sorting?: SortingState;
  pagination?: PaginationState;
  globalFilter?: string;
  columnFilters?: ColumnFiltersState;
  columnSizing?: ColumnSizingState;
  onStateChange?: (state: DataTableState) => void;
}) => {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>(visibilityInput);
  const [globalFilter, setGlobalFilter] = useState(globalFilterInput);
  const [sorting, setSorting] = useState<SortingState>(sortingInput);
  const [pagination, setPagination] = useState(paginationInput);
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(columnFiltersInput);
  const [columnSizing, setColumnSizing] =
    useState<ColumnSizingState>(columnSizingInput);

  useEffect(() => {
    onStateChange?.({ globalFilter, sorting, columnFilters, columnSizing });
  }, [onStateChange, globalFilter, sorting, columnFilters, columnSizing]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      rowSelection,
      pagination,
      columnFilters,
      columnSizing,
    },
    getRowId: (row) => row.uuid,
    enableRowSelection: true,
    enableColumnResizing: true,
    // column sizes are relative share units, not pixels; without this,
    // TanStack's default 20px minimum inflates small columns
    defaultColumn: { minSize: 1 },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
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
