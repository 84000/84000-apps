import {
  TABLE_CELL_STYLE,
  TABLE_HEAD_STYLE,
  TABLE_ROW_STYLE,
  TABLE_STYLE,
} from '@eightyfourthousand/design-system';
import { cn } from '@eightyfourthousand/lib-utils';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TableKit as TipTapTableKit, TableView } from '@tiptap/extension-table';

const TABLE_CLASS = cn(TABLE_STYLE, 'mt-5 mb-10');

/**
 * Table node view that keeps the table's classes, which TipTap's own view
 * drops, so a live editor matches static and SSR HTML.
 */
class StyledTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.table.className = TABLE_CLASS;
  }
}

export const TableKit = TipTapTableKit.configure({
  table: {
    cellMinWidth: 100,
    HTMLAttributes: {
      class: TABLE_CLASS,
    },
    View: StyledTableView,
  },
  tableRow: {
    HTMLAttributes: {
      class: TABLE_ROW_STYLE,
    },
  },
  tableHeader: {
    HTMLAttributes: {
      class: cn(TABLE_HEAD_STYLE, 'ps-0'),
    },
  },
  tableCell: {
    HTMLAttributes: {
      class: cn(TABLE_CELL_STYLE, 'ps-0'),
    },
  },
});
