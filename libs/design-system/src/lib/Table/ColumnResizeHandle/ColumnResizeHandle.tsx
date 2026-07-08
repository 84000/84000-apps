'use client';

import { Header, RowData, Table } from '@tanstack/react-table';
import { PointerEvent as ReactPointerEvent, useRef } from 'react';

/**
 * Redistribute size between a column and its right-hand neighbor, keeping
 * their combined share — and therefore the table's total width — constant.
 */
export const resizePair = ({
  size,
  neighborSize,
  delta,
  minSize,
}: {
  size: number;
  neighborSize: number;
  delta: number;
  minSize: number;
}): { size: number; neighborSize: number } => {
  const total = size + neighborSize;
  if (total <= 2 * minSize) {
    return { size, neighborSize };
  }
  const next = Math.min(Math.max(size + delta, minSize), total - minSize);
  return { size: next, neighborSize: total - next };
};

// minimum column width in pixels, converted to share units per drag
const MIN_COLUMN_PX = 48;

/**
 * Drag handle on a header's right edge that resizes the column against its
 * right-hand neighbor. Pair-wise redistribution keeps the table's total
 * width fixed, so columns stay percentage-sized and never overflow.
 */
export const ColumnResizeHandle = <T extends RowData>({
  table,
  header,
  neighborId,
}: {
  table: Table<T>;
  header: Header<T, unknown>;
  neighborId: string;
}) => {
  const dragState = useRef<{
    startX: number;
    size: number;
    neighborSize: number;
    sharePerPx: number;
  } | null>(null);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) {
      return;
    }
    const delta = (event.clientX - drag.startX) * drag.sharePerPx;
    const resized = resizePair({
      size: drag.size,
      neighborSize: drag.neighborSize,
      delta,
      minSize: MIN_COLUMN_PX * drag.sharePerPx,
    });
    table.setColumnSizing((previous) => ({
      ...previous,
      [header.column.id]: resized.size,
      [neighborId]: resized.neighborSize,
    }));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const tableEl = event.currentTarget.closest('table');
    const tableWidth = tableEl?.getBoundingClientRect().width || 0;
    if (!tableWidth) {
      return;
    }
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // inactive pointer id (e.g. synthetic events); the drag still works
      // while the pointer stays over the handle
    }
    dragState.current = {
      startX: event.clientX,
      size: header.column.getSize(),
      neighborSize: table.getColumn(neighborId)?.getSize() ?? 0,
      sharePerPx: table.getTotalSize() / tableWidth,
    };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // capture was never taken
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${header.column.id} column`}
      className="group/resize absolute -right-1 top-0 h-full w-2 cursor-col-resize touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mx-auto h-full w-px bg-border/20 group-hover/resize:bg-border group-active/resize:bg-border" />
    </div>
  );
};
