import { cn } from '@lib-utils';
import { EyeIcon, MoreHorizontalIcon } from 'lucide-react';
import { TableProject } from './TableProject';
import { ProjectStageLabel } from '@data-access';
import { filterFn as canonsFilterFn } from './FilterCanonDropdown';
import { filterFn as pagesFilterFn } from './FilterPagesDropdown';
import { filterFn as tohsFilterFn } from './FilterTohsDropdown';
import {
  DataTableColumn,
  SortableHeader,
  StageChip,
  TooltipCell,
} from '@design-system';
import { usePathname, useRouter } from 'next/navigation';
import { Cell } from '@tanstack/react-table';

const ProjectHeader = SortableHeader<TableProject>;

export const CLASSNAME_FOR_COL: { [key: string]: string } = {
  toh: 'xl:w-[100px] md:w-[60px] w-[40px]',
  title: 'xl:w-[720px] lg:w-[580px] md:w-[320px] w-[112px]',
  translator: 'xl:w-[160px] lg:w-[120px] md:w-[100px] w-[60px]',
  stage: 'w-[60px]',
  pages: 'w-[60px]',
  stageDate: 'w-[100px]',
  uuid: 'w-5',
};

export const PROJECT_COLUMNS: DataTableColumn<TableProject>[] = [
  {
    id: 'toh',
    accessorKey: 'toh',
    filterFn: tohsFilterFn,
    header: ({ column }) => <ProjectHeader column={column} name="Toh" />,
    cell: ({ row }) => (
      <TooltipCell
        className={CLASSNAME_FOR_COL.toh}
        content={row.original.toh}
      />
    ),
    className: CLASSNAME_FOR_COL.toh,
  },
  {
    id: 'title',
    accessorKey: 'title',
    enableGlobalFilter: false,
    header: ({ column }) => <ProjectHeader column={column} name="Work Title" />,
    cell: ({ row }) => (
      <TooltipCell
        className={CLASSNAME_FOR_COL.title}
        content={row.original.title}
      />
    ),
    className: CLASSNAME_FOR_COL.title,
  },
  {
    accessorKey: 'plainTitle',
    cell: ({ row }) => row.original.plainTitle,
  },
  {
    id: 'translator',
    accessorKey: 'translator',
    header: ({ column }) => <ProjectHeader column={column} name="Translator" />,
    cell: ({ row }) => (
      <TooltipCell
        className={CLASSNAME_FOR_COL.translator}
        content={row.original.translator}
      />
    ),
    className: CLASSNAME_FOR_COL.translator,
  },
  {
    id: 'stage',
    accessorKey: 'stage',
    filterFn: (row, columnId, filter: ProjectStageLabel[]) => {
      if (!filter.length) return true;
      const value = row.getValue(columnId) as ProjectStageLabel;
      return filter.includes(value);
    },
    header: ({ column }) => <ProjectHeader column={column} name="Stage" />,
    cell: ({ row }) => (
      <div className={CLASSNAME_FOR_COL.stage}>
        <StageChip stage={row.original.stageObject.label} />
      </div>
    ),
    className: CLASSNAME_FOR_COL.stage,
  },
  {
    id: 'pages',
    accessorKey: 'pages',
    filterFn: pagesFilterFn,
    header: ({ column }) => <ProjectHeader column={column} name="Pages" />,
    cell: ({ row }) => (
      <div className={CLASSNAME_FOR_COL.pages}>{row.original.pages}</div>
    ),
    className: CLASSNAME_FOR_COL.pages,
  },
  {
    id: 'stageDate',
    accessorKey: 'stageDate',
    header: ({ column }) => <ProjectHeader column={column} name="Stage Date" />,
    cell: ({ row }) => (
      <div className={CLASSNAME_FOR_COL.stageDate}>
        {row.original.stageDate}
      </div>
    ),
    className: CLASSNAME_FOR_COL.stageDate,
  },
  {
    id: 'uuid',
    accessorKey: 'uuid',
    header: '',
    enableColumnFilter: false,
    enableSorting: false,
    cell: () => (
      <div className={cn(CLASSNAME_FOR_COL.uuid, 'text-brick')}>
        <MoreHorizontalIcon
          className={cn(CLASSNAME_FOR_COL.uuid, 'group-hover:hidden block')}
        />
        <EyeIcon
          className={cn(CLASSNAME_FOR_COL.uuid, 'hidden group-hover:block')}
        />
      </div>
    ),
    className: CLASSNAME_FOR_COL.uuid,
  },
  {
    accessorKey: 'canons',
    filterFn: canonsFilterFn,
    cell: ({ row }) => row.original.canons,
  },
];

export const useProjectColumns = () => {
  const router = useRouter();
  const pathname = usePathname();
  const columns = PROJECT_COLUMNS.map((col) => ({
    ...col,
    onCellClick: (cell: Cell<TableProject, unknown>) => {
      router.push(`${pathname}/${cell.row.original.uuid}`);
    },
  }));

  return { columns };
};
