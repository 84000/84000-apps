'use client';

import { Button } from '@design-system';
import { RowData, Table } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { PaginationEllipsis } from './PaginationEllipsis';

interface TablePaginationProps<T extends RowData> {
  table: Table<T>;
}

export const TablePagination = <T extends RowData>({
  table,
}: TablePaginationProps<T>) => {
  const page = table.getState().pagination.pageIndex;
  const totalPages = table.getPageCount();

  const pagesToShow = [];
  if (page > 0) {
    pagesToShow.push(page - 1);
  }

  pagesToShow.push(page);

  if (page + 1 < totalPages) {
    pagesToShow.push(page + 1);
  }

  if (pagesToShow.length < 3 && page + 2 < totalPages) {
    pagesToShow.push(page + 2);
  }

  return (
    <div className="flex items-center justify-between px-4">
      <div className="flex-1 flex" />
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Button
            variant="ghost"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeftIcon />
            Previous
          </Button>
          {page > 1 && <PaginationEllipsis />}
          {pagesToShow.map((p) => (
            <Button
              key={p}
              variant={p === page ? 'outline' : 'ghost'}
              onClick={() => table.setPageIndex(p)}
              className="w-10"
            >
              {p + 1}
            </Button>
          ))}
          {totalPages > 3 && page < totalPages - 2 && <PaginationEllipsis />}
          <Button
            variant="ghost"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            Next
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
};
