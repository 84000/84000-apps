import {
  TABLE_CELL_STYLE,
  TABLE_HEAD_STYLE,
  TABLE_ROW_STYLE,
  TABLE_STYLE,
} from '@design-system';
import { cn } from '@lib-utils';
import { TableKit as TipTapTableKit } from '@tiptap/extension-table';

export const TableKit = TipTapTableKit.configure({
  table: {
    cellMinWidth: 100,
    HTMLAttributes: {
      class: cn(TABLE_STYLE, 'mt-5 mb-10'),
    },
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
