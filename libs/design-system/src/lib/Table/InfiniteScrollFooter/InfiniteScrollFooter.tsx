'use client';

import { RowData, Table } from '@tanstack/react-table';
import { useEffect, useRef } from 'react';

const DEFAULT_STEP = 50;

/**
 * Sentinel that grows the table's page size as it scrolls into view,
 * turning client-side pagination into infinite scroll. Renders nothing
 * once every row is visible.
 */
export const InfiniteScrollFooter = <T extends RowData>({
  table,
  step = DEFAULT_STEP,
}: {
  table: Table<T>;
  step?: number;
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const totalRows = table.getPrePaginationRowModel().rows.length;
  const { pageSize } = table.getState().pagination;
  const hasMore = pageSize < totalRows;

  // shrink back to one page whenever the filters change: the user wants the
  // top matches, and re-rendering hundreds of grown rows on every keystroke
  // makes search feel sluggish
  const { globalFilter, columnFilters } = table.getState();
  useEffect(() => {
    table.setPageSize(step);
  }, [table, step, globalFilter, columnFilters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          table.setPageSize(pageSize + step);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [table, pageSize, step, hasMore]);

  return hasMore ? <div ref={sentinelRef} className="h-px" /> : null;
};
