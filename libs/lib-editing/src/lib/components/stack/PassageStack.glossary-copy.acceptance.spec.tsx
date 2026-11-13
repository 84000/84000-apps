import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStack } from './PassageStack';
import { PassageStackController } from './PassageStackController';
import { createStackWorkDocument } from './stack-work';
import { flush, seeds, source } from './stack-controller.fixture';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
// The footer's image needs Next's loader.
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  LotusPond: () => null,
}));

// jsdom lays nothing out, so the virtualizer would draw no rows. Draw them all.
jest.mock('@tanstack/react-virtual', () => ({
  measureElement: jest.fn(),
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * 100,
        end: (index + 1) * 100,
        size: 100,
      })),
    getTotalSize: () => count * 100,
    measureElement: () => undefined,
    measurementsCache: [],
    scrollToIndex: jest.fn(),
    scrollToOffset: jest.fn(),
  }),
}));

beforeAll(() => {
  // ProseMirror measures when it focuses; jsdom has no layout to measure.
  const rects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  });
  Range.prototype.getClientRects = rects as never;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  document.body.innerHTML = '';
});

// DEV-911 criterion 7: only editors who can edit see "Copy from Another
// Work". The stack mounts a glossary row's label menu only when it is not
// read-only, so a reader's view never offers it. Written beside the
// PassageStack read-only specs, whose harness it reuses.

/** A hydrated two-row glossary stack, drawn. */
const setup = async (readOnly: boolean) => {
  const all = seeds(2).map((entry) => ({
    ...entry,
    meta: { ...entry.meta, type: 'glossary' },
  }));
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
  });
  work.seedSpine(all.map((entry) => entry.meta));
  const controller = new PassageStackController({
    work,
    rows: 'glossary',
    readOnly,
  });
  controller.setVisibleRange({ start: 0, end: 2 });
  await flush();
  render(<PassageStack controller={controller} />);
  await act(flush);
  return { controller };
};

const openLabelMenu = async () => {
  const label = document.querySelector('[data-stack-passage="p1"] .labeled');
  expect(label).not.toBeNull();
  await act(async () => {
    label?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PassageStack glossary label menu: Copy from Another Work', () => {
  it('is offered to an editor, beside Copy Link and Delete', async () => {
    await setup(false);
    await openLabelMenu();

    expect(await screen.findByText('Copy Link')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Copy from Another Work')).toBeTruthy();
  });

  it('is not offered to a reader, who has no editing menu at all', async () => {
    await setup(true);
    await openLabelMenu();

    expect(screen.queryByText('Copy from Another Work')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('goes when the view turns read-only', async () => {
    const { controller } = await setup(false);
    await act(async () => controller.setReadOnly(true));
    await act(flush);
    await openLabelMenu();

    expect(screen.queryByText('Copy from Another Work')).toBeNull();
  });
});
