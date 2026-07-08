import { act, render, screen } from '@testing-library/react';
import { DataTable } from '../DataTable/DataTable';
import { DataTableColumn } from '../hooks';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  observedElements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.observedElements.add(element);
  };

  disconnect = () => {
    this.observedElements.clear();
  };

  unobserve = (element: Element) => {
    this.observedElements.delete(element);
  };
}

const emitIntersection = () => {
  const observer = MockIntersectionObserver.instances.at(-1);

  if (!observer) {
    throw new Error('No IntersectionObserver instance was created.');
  }

  const target = observer.observedElements.values().next().value as Element;
  act(() => {
    observer.callback(
      [{ target, isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    );
  });
};

type Row = { uuid: string; title: string };

const columns: DataTableColumn<Row>[] = [
  {
    id: 'title',
    accessorKey: 'title',
    header: () => 'Title',
  },
];

const rows: Row[] = Array.from({ length: 120 }, (_, i) => ({
  uuid: `uuid-${i}`,
  title: `Work ${i}`,
}));

const countBodyRows = () => screen.getAllByRole('row').length - 1;

describe('DataTable with infiniteScroll', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it('renders more rows as the sentinel intersects and stops at the end', () => {
    render(
      <DataTable name="works" data={rows} columns={columns} infiniteScroll />,
    );

    expect(countBodyRows()).toBe(50);

    emitIntersection();
    expect(countBodyRows()).toBe(100);

    emitIntersection();
    expect(countBodyRows()).toBe(120);

    const observer = MockIntersectionObserver.instances.at(-1);
    expect(observer?.observedElements.size).toBe(0);
  });

  it('does not render numbered pagination', () => {
    render(
      <DataTable name="works" data={rows} columns={columns} infiniteScroll />,
    );

    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByText('Previous')).toBeNull();
  });
});
