import { act, render, screen, waitFor } from '@testing-library/react';
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

/** A hydrated two-passage stack, drawn. */
const setup = async (readOnly: boolean) => {
  const all = seeds(2);
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
  });
  work.seedSpine(all.map((entry) => entry.meta));
  const controller = new PassageStackController({ work, readOnly });
  controller.setVisibleRange({ start: 0, end: 2 });
  await flush();
  const view = render(<PassageStack controller={controller} />);
  await act(flush);
  return { controller, view };
};

/** A press and release at the same point, as a click is. */
const press = (element: Element) => {
  element.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: 5, clientY: 5 }),
  );
  element.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: 5, clientY: 5 }),
  );
};

const editors = () => document.querySelectorAll('.ProseMirror');
const editable = () => document.querySelectorAll('[contenteditable="true"]');
const textOf = (uuid: string) =>
  document.querySelector(`[data-stack-passage="${uuid}"] .tiptap`) as Element;

describe('PassageStack read-only', () => {
  it('mounts no editor when a row is clicked', async () => {
    const { controller } = await setup(true);
    expect(textOf('p0')?.textContent).toBe('passage 0 text');

    await act(async () => press(textOf('p0')));
    await act(flush);

    expect(controller.getFocusedUuid()).toBeNull();
    expect(editors()).toHaveLength(0);
    expect(editable()).toHaveLength(0);
  });

  it('opens the reader label menu, not the editor one', async () => {
    await setup(true);
    const label = document.querySelector('[data-stack-passage="p1"] .labeled');

    await act(async () => {
      label?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(await screen.findByText('Copy Link')).toBeTruthy();
    expect(screen.getByText('Add Bookmark')).toBeTruthy();
    expect(screen.getByText('Suggest Revision')).toBeTruthy();
    expect(screen.queryByText('Edit Label')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('turns live rows static when switched to read-only, and back', async () => {
    const { controller } = await setup(false);

    await act(async () => {
      controller.focusPassage('p0');
    });
    await waitFor(() => expect(editors().length).toBeGreaterThan(0));

    await act(async () => controller.setReadOnly(true));
    await act(flush);
    expect(editors()).toHaveLength(0);
    expect(textOf('p0')?.textContent).toBe('passage 0 text');

    await act(async () => controller.setReadOnly(false));
    await act(async () => {
      controller.focusPassage('p1');
    });
    await waitFor(() => expect(controller.getFocusedUuid()).toBe('p1'));
    await waitFor(() => expect(editors().length).toBeGreaterThan(0));
  });
});
