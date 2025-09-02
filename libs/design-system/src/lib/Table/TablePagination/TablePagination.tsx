'use client';

import { RowData, Table } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '../../Button/Button';
import { PaginationEllipsis } from '../PaginationEllipsis/PaginationEllipsis';

// if there are fewer than MIN_PAGES, don't show pagination
const MIN_PAGES = 2;

// settings that control how many page buttons to show
const PAGINATION_THRESH = 3;
const PAGINATION_REMAINDER_THRESH = PAGINATION_THRESH - 1;

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

  if (
    pagesToShow.length < PAGINATION_THRESH &&
    page + PAGINATION_REMAINDER_THRESH < totalPages
  ) {
    pagesToShow.push(page + PAGINATION_REMAINDER_THRESH);
  }

  if (totalPages < MIN_PAGES) {
    return null;
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
          {totalPages > PAGINATION_THRESH &&
            page < totalPages - PAGINATION_REMAINDER_THRESH && (
              <PaginationEllipsis />
            )}
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
