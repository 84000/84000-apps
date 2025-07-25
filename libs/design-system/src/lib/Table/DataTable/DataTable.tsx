'use client';

import {
  Cell,
  Table as HeadlessTable,
  PaginationState,
  SortingState,
  VisibilityState,
  flexRender,
} from '@tanstack/react-table';
import { ReactElement, useEffect, useState } from 'react';
import { cn } from '@lib-utils';
import { DataTableColumn, DataTableRow, useDataTable } from '../hooks';
import { FilterResultsBanner } from '../FilterResultsBanner/FilterResultsBanner';
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
  filters,
}: {
  name: string;
  data: T[];
  columns: DataTableColumn<T>[];
  visibility?: VisibilityState;
  sorting?: SortingState;
  pagination?: PaginationState;
  globalFilter?: string;
  filters?: (table: HeadlessTable<T>) => ReactElement;
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
    pagination,
    globalFilter,
  });

  return (
    <div className="w-full flex flex-col gap-4">
      {filters && filters(table)}
      <FilterResultsBanner table={table} name={name} />
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={columnClasses[header.id]}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination table={table} />
    </div>
  );
};
