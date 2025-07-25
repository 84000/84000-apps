import { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';
import { FilterDropdown } from '../FilterDropdown/FilterDropdown';
import { FuzzyGlobalFilter } from '../FuzzyGlobalFilter/FuzzyGlobalFilter';
import { SortableHeader } from '../SortableHeader/SortableHeader';
import { DataTableColumn, DataTableRow } from '../hooks';

export type InvoiceRow = DataTableRow & {
  uuid: string;
  invoice: string;
  status: 'Paid' | 'Unpaid';
  method: 'Credit Card' | 'Transfer' | 'Cash';
  amount: number;
};

const InvoiceHeader = SortableHeader<InvoiceRow>;
const StatusFilter = FilterDropdown<InvoiceRow>;

const DATA: InvoiceRow[] = [
  {
    uuid: '1',
    invoice: 'INV001',
    status: 'Paid',
    method: 'Credit Card',
    amount: 250,
  },
  {
    uuid: '2',
    invoice: 'INV002',
    status: 'Unpaid',
    method: 'Transfer',
    amount: 150,
  },
  { uuid: '3', invoice: 'INV003', status: 'Paid', method: 'Cash', amount: 300 },
  {
    uuid: '4',
    invoice: 'INV004',
    status: 'Unpaid',
    method: 'Credit Card',
    amount: 400,
  },
  {
    uuid: '5',
    invoice: 'INV005',
    status: 'Paid',
    method: 'Transfer',
    amount: 500,
  },
];

const COLUMNS: DataTableColumn<InvoiceRow>[] = [
  { accessorKey: 'uuid' },
  {
    id: 'invoice',
    accessorKey: 'invoice',
    className: 'w-[100px] font-semibold',
    header: ({ column }) => <InvoiceHeader column={column} name="Invoice" />,
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => <InvoiceHeader column={column} name="Status" />,
    filterFn: (row, columnId, filterValue) => {
      const status = row.getValue(columnId) as string;
      const statuses = filterValue as string[];
      return statuses.length === 0 || statuses.includes(status);
    },
  },
  {
    id: 'method',
    accessorKey: 'method',
    header: ({ column }) => <InvoiceHeader column={column} name="Method" />,
  },
  {
    id: 'amount',
    header: ({ column }) => <InvoiceHeader column={column} name="Amount" />,
    accessorKey: 'amount',
    className: 'text-right',
    cell: ({ row }) => `$${row.original.amount.toFixed(2)}`,
  },
];

const meta: Meta<typeof DataTable> = {
  title: 'Table/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};

export type Story = StoryObj<typeof DataTable>;

export const Default: Story = {
  argTypes: {
    name: { control: false, description: 'Name of the data table' },
    data: { control: false, description: 'Data to display in the table' },
    columns: { control: false, description: 'Columns configuration' },
    visibility: {
      control: false,
      description: 'Visibility settings for columns',
    },
    sorting: {
      control: false,
      description: 'Initial sorting configuration',
    },
    filters: {
      control: false,
      description: 'Custom filters for the table',
    },
    pagination: {
      control: false,
      description: 'Pagination settings for the table',
    },
    globalFilter: {
      control: false,
      description: 'Initial global filter for the table',
    },
  },
  render: (_props) => (
    <DataTable
      name="invoices"
      data={DATA}
      columns={COLUMNS}
      visibility={{ uuid: false }}
      sorting={[{ id: 'amount', desc: true }]}
      filters={(table) => (
        <div className="flex gap-2">
          <FuzzyGlobalFilter table={table} placeholder="Search invoices..." />
          <StatusFilter
            table={table}
            column="status"
            options={['Paid', 'Unpaid']}
            placeholder="Filter by status"
            className="w-24"
          />
        </div>
      )}
    />
  ),
};

export default meta;
