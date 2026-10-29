import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStack } from './PassageStack';
import { PassageStackController } from './PassageStackController';
import { StackController } from './StackController';
import { createStackWorkDocument } from './stack-work';
import { seeds, source } from './stack-controller.fixture';

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

/** The viewport the scroller reports once the browser has it. */
const VIEWPORT = { width: 800, height: 1200 };

beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

/**
 * A stack whose passages are in memory before anything renders — what a
 * server render has to work with, since it runs no effects.
 */
const seededStack = (count: number, view: 'reader' | 'editor') => {
  const all = seeds(count);
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)], buffer: 0 }),
  });
  const charCounts = StackController.seedWork(work, all);
  const options = { work, charCounts, readOnly: view === 'reader' };
  return view === 'reader'
    ? new StackController(options)
    : new PassageStackController(options);
};

/** The scroller a host gives the stack, sized as a browser would size it. */
const scroller = () => {
  const element = document.createElement('div');
  element.style.overflowY = 'auto';
  // The virtualizer reads a scroller's size from its offset box.
  Object.defineProperty(element, 'offsetWidth', { value: VIEWPORT.width });
  Object.defineProperty(element, 'offsetHeight', { value: VIEWPORT.height });
  document.body.appendChild(element);
  return element;
};

const rows = (container: Element) =>
  Array.from(container.querySelectorAll('[data-stack-passage]'));

describe.each(['reader', 'editor'] as const)(
  'PassageStack server render (%s)',
  (view) => {
    it('draws the first window on the server, with no effects run', () => {
      const html = renderToString(
        <PassageStack controller={seededStack(30, view)} />,
      );
      const container = document.createElement('div');
      container.innerHTML = html;

      const drawn = rows(container);
      expect(drawn.length).toBeGreaterThan(0);
      expect(drawn[0].getAttribute('data-stack-passage')).toBe('p0');
      expect(container.textContent).toContain('passage 0 text');
    });

    it('lays the window out in flow, with no per-row offsets', () => {
      const container = document.createElement('div');
      container.innerHTML = renderToString(
        <PassageStack controller={seededStack(3, view)} />,
      );

      const list = container.querySelector('[data-stack-window]');
      expect(list).not.toBeNull();
      const rowBoxes = Array.from(list?.children ?? []) as HTMLElement[];
      expect(rowBoxes).toHaveLength(3);
      rowBoxes.forEach((box) => {
        expect(box.style.transform).toBe('');
        expect(box.style.position).toBe('');
        expect(box.className).not.toContain('absolute');
      });
    });

    it('is taken over in the browser without replacing or moving a row', async () => {
      const controller = seededStack(30, view);
      const host = scroller();
      host.innerHTML = renderToString(<PassageStack controller={controller} />);
      const before = rows(host);
      const offsetBefore = (
        host.querySelector('[data-stack-window]') as HTMLElement
      ).style.paddingTop;

      const errors = jest.spyOn(console, 'error').mockImplementation(() => {
        // Collected: a hydration mismatch is reported here.
      });
      await act(async () => {
        root = hydrateRoot(host, <PassageStack controller={controller} />);
      });
      const reported = errors.mock.calls.map((call) => String(call[0]));
      errors.mockRestore();

      expect(reported).toEqual([]);
      const after = rows(host);
      // The same nodes, in the same place: React adopted the server's rows.
      expect(after.slice(0, before.length)).toEqual(before);
      expect(
        (host.querySelector('[data-stack-window]') as HTMLElement).style
          .paddingTop,
      ).toBe(offsetBefore);
    });
  },
);
