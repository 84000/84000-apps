'use client';

import {
  Cell,
  ColumnFiltersState,
  ColumnSizingState,
  Header,
  Table as HeadlessTable,
  PaginationState,
  SortingState,
  VisibilityState,
  flexRender,
} from '@tanstack/react-table';
import { ReactElement, useEffect, useState } from 'react';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  DataTableColumn,
  DataTableRow,
  DataTableState,
  useDataTable,
} from '../hooks';
import { ColumnResizeHandle } from '../ColumnResizeHandle/ColumnResizeHandle';
import { FilterResultsBanner } from '../FilterResultsBanner/FilterResultsBanner';
import { InfiniteScrollFooter } from '../InfiniteScrollFooter/InfiniteScrollFooter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../Table';
import { TablePagination } from '../TablePagination/TablePagination';

export const DataTable = <T extends DataTableRow>({
  name,
  data,
  columns,
  visibility,
  sorting,
  pagination,
  globalFilter,
  columnFilters,
  columnSizing,
  onStateChange,
  className,
  filters,
  infiniteScroll = false,
  resizableColumns = false,
}: {
  name: string;
  data: T[];
  columns: DataTableColumn<T>[];
  visibility?: VisibilityState;
  sorting?: SortingState;
  pagination?: PaginationState;
  globalFilter?: string;
  columnFilters?: ColumnFiltersState;
  columnSizing?: ColumnSizingState;
  onStateChange?: (state: DataTableState) => void;
  className?: string;
  filters?: (table: HeadlessTable<T>) => ReactElement;
  infiniteScroll?: boolean;
  resizableColumns?: boolean;
}) => {
  const [columnClasses, setColumnClasses] = useState<{ [key: string]: string }>(
    {},
  );
  const [columnActions, setColumnActions] = useState<{
    [key: string]: (row: Cell<T, unknown>) => void;
  }>({});

  useEffect(() => {
    const classes: { [key: string]: string } = {};
    const actions: { [key: string]: (row: Cell<T, unknown>) => void } = {};
    columns.forEach((column) => {
      if (column.id) {
        if (column.className) {
          classes[column.id] = column.className;
        }
        if (column.onCellClick) {
          actions[column.id] = column.onCellClick;
        }
      }
    });
    setColumnClasses(classes);
    setColumnActions(actions);
  }, [columns]);
  const { table } = useDataTable({
    data,
    columns,
    visibility,
    sorting,
    pagination:
      pagination ??
      (infiniteScroll ? { pageIndex: 0, pageSize: 50 } : undefined),
    globalFilter,
    columnFilters,
    columnSizing,
    onStateChange,
  });

  // percentage widths keep the resizable table filling — and never
  // overflowing — its container at any viewport size
  const headerWidth = (header: Header<T, unknown>) =>
    resizableColumns
      ? { width: `${(header.getSize() / table.getTotalSize()) * 100}%` }
      : undefined;

  const resizeNeighbor = (header: Header<T, unknown>) => {
    if (!resizableColumns || !header.column.getCanResize()) {
      return undefined;
    }
    const headers = header.headerGroup.headers;
    const neighbor = headers[header.index + 1];
    return neighbor?.column.getCanResize() ? neighbor.column.id : undefined;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {filters && (
        <>
          {filters(table)}
          <FilterResultsBanner table={table} name={name} />
        </>
      )}
      <div
        className={cn(
          'overflow-hidden rounded-2xl border shadow-md',
          className,
        )}
      >
        <Table className={cn('bg-background', resizableColumns && 'table-fixed')}>
          <TableHeader className="sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const neighborId = resizeNeighbor(header);
                  return (
                    <TableHead
                      className={cn(
                        columnClasses[header.id],
                        resizableColumns && 'relative',
                      )}
                      style={headerWidth(header)}
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {neighborId && (
                        <ColumnResizeHandle
                          table={table}
                          header={header}
                          neighborId={neighborId}
                        />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow className="group" key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'py-3 hover:cursor-pointer',
                          columnClasses[cell.column.id],
                          resizableColumns && 'overflow-hidden',
                        )}
                        onClick={() => columnActions[cell.column.id]?.(cell)}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No {name ? name : 'results'}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {infiniteScroll ? (
        <InfiniteScrollFooter table={table} />
      ) : (
        <TablePagination table={table} />
      )}
    </div>
  );
};
