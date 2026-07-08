import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable } from '../DataTable/DataTable';
import { DataTableColumn } from '../hooks';
import { resizePair } from './ColumnResizeHandle';

describe('resizePair', () => {
  it('moves size between neighbors, keeping the total constant', () => {
    expect(
      resizePair({ size: 50, neighborSize: 30, delta: 10, minSize: 5 }),
    ).toEqual({ size: 60, neighborSize: 20 });
    expect(
      resizePair({ size: 50, neighborSize: 30, delta: -10, minSize: 5 }),
    ).toEqual({ size: 40, neighborSize: 40 });
  });

  it('clamps both columns to the minimum size', () => {
    expect(
      resizePair({ size: 50, neighborSize: 30, delta: 100, minSize: 5 }),
    ).toEqual({ size: 75, neighborSize: 5 });
    expect(
      resizePair({ size: 50, neighborSize: 30, delta: -100, minSize: 5 }),
    ).toEqual({ size: 5, neighborSize: 75 });
  });

  it('does nothing when there is no room to resize', () => {
    expect(
      resizePair({ size: 5, neighborSize: 5, delta: 10, minSize: 5 }),
    ).toEqual({ size: 5, neighborSize: 5 });
  });
});

type Row = { uuid: string; name: string; count: number };

const columns: DataTableColumn<Row>[] = [
  { id: 'name', accessorKey: 'name', size: 60, header: () => 'Name' },
  { id: 'count', accessorKey: 'count', size: 40, header: () => 'Count' },
];

const rows: Row[] = [
  { uuid: '1', name: 'first', count: 1 },
  { uuid: '2', name: 'second', count: 2 },
];

const headerWidths = () =>
  screen
    .getAllByRole('columnheader')
    .map((th) => (th as HTMLElement).style.width);

describe('DataTable with resizableColumns', () => {
  beforeEach(() => {
    jest
      .spyOn(HTMLTableElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 1000 } as DOMRect);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sizes columns as percentages of the table', () => {
    render(
      <DataTable name="things" data={rows} columns={columns} resizableColumns />,
    );
    expect(headerWidths()).toEqual(['60%', '40%']);
  });

  it('redistributes width between neighbors on drag, keeping 100% total', () => {
    render(
      <DataTable name="things" data={rows} columns={columns} resizableColumns />,
    );
    const handle = screen.getByRole('separator', {
      name: 'Resize name column',
    });

    // drag 100px right on a 1000px-wide table: 10 share units. jsdom cannot
    // construct PointerEvents with coordinates, so dispatch MouseEvents with
    // pointer types — React handlers listen by event type.
    const pointer = (type: string, clientX: number) =>
      fireEvent(handle, new MouseEvent(type, { clientX, bubbles: true }));
    pointer('pointerdown', 0);
    pointer('pointermove', 100);
    pointer('pointerup', 100);

    expect(headerWidths()).toEqual(['70%', '30%']);
  });

  it('does not render handles or width styles by default', () => {
    render(<DataTable name="things" data={rows} columns={columns} />);
    expect(screen.queryByRole('separator')).toBeNull();
    expect(headerWidths()).toEqual(['', '']);
  });
});
