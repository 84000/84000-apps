/**
 * Acceptance tests for DEV-837 item 4a, AC4 (and AC6): a `StackReaderProvider`
 * given a seed for every section draws the endnotes tab's first window on the
 * server as well as the translation's, and the browser keeps those rows.
 *
 * Written from the spec, not the implementation. Only the network is faked.
 */
import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { PassageStack } from './PassageStack';
import { loadStackReaderSeed } from './stack-reader-seed';
import { StackReaderProvider } from './StackReaderProvider';
import { STACK_SECTIONS } from './stack-seed';
import { useStackWork } from './stack-work-context';

// See PassageStackController.spec.ts: building the stack schema reaches
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

const mockRequest = jest.fn();
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({ request: mockRequest })),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

// What the server's read goes through (`loadStackReaderSeed`).
jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  // The bibliography the seed also reads; these tests are about the sections.
  getWorkBibliography: jest.fn(async () => []),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getTranslationBlocksAround: jest.Mock;
};
const serverApi = jest.requireMock(
  '@eightyfourthousand/client-graphql/ssr',
) as { getPassageMetaPage: jest.Mock; getTranslationBlocks: jest.Mock };

const Stack = ({ tab }: { tab: string }) => {
  const view = useStackWork()?.controllerFor(tab);
  return view ? <PassageStack controller={view} /> : null;
};

/** The scroller a host gives the stacks, sized as a browser would size it. */
const scroller = () => {
  const element = document.createElement('div');
  element.style.overflowY = 'auto';
  Object.defineProperty(element, 'offsetWidth', { value: 800 });
  Object.defineProperty(element, 'offsetHeight', { value: 1200 });
  document.body.appendChild(element);
  return element;
};

const rows = (container: Element) =>
  Array.from(container.querySelectorAll('[data-stack-passage]'));

const reads = () => [
  clientGraphql.getPassageMetaPage,
  clientGraphql.getTranslationBlocks,
  clientGraphql.getTranslationBlocksAround,
  mockRequest,
];

let root: Root | null = null;

beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  reads().forEach((read) => read.mockReset());
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const REAL_TYPE: Record<string, string> = {
  front: 'introduction',
  translation: 'translation',
  abbreviations: 'abbreviations',
  endnotes: 'endnotes',
};

describe('a seed read by loadStackReaderSeed (AC3 into AC4)', () => {
  const metaPageOf = (tab: string) => ({
    metas: [0, 1, 2].map((i) => ({
      uuid: `${tab}-${i}`,
      label: `${i}`,
      // A passage's own type, as the API serves it, not the filter asked by.
      type: REAL_TYPE[tab],
    })),
    nextCursor: `${tab}-2`,
    hasMoreAfter: false,
    hasMoreBefore: false,
  });
  const tabOf: Record<string, string> = Object.fromEntries(
    STACK_SECTIONS.map(({ tab, type }) => [type, tab]),
  );

  it('draws the endnotes’ first rows on the server and keeps them on hydration', async () => {
    // The server answers by section: it is asked for each by its type filter.
    serverApi.getPassageMetaPage.mockImplementation(async ({ type }) =>
      metaPageOf(tabOf[type]),
    );
    serverApi.getTranslationBlocks.mockImplementation(async ({ type }) => {
      const tab = tabOf[type];
      return {
        blocks: [0, 1, 2].map((i) => ({
          type: 'passage',
          attrs: { uuid: `${tab}-${i}` },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `read ${tab} ${i} text` }],
            },
          ],
        })),
      };
    });
    const read = await loadStackReaderSeed({
      client: {} as never,
      workUuid: 'w1',
    });

    const Read = () => (
      <StackReaderProvider workUuid="w1" seed={read}>
        <Stack tab="endnotes" />
        <Stack tab="translation" />
      </StackReaderProvider>
    );
    const host = scroller();
    host.innerHTML = renderToString(<Read />);
    const served = rows(host);

    expect(served.map((row) => row.id).sort()).toEqual([
      'endnotes-0',
      'endnotes-1',
      'endnotes-2',
      'translation-0',
      'translation-1',
      'translation-2',
    ]);
    expect(host.textContent).toContain('read endnotes 2 text');

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {
      // Collected: a hydration mismatch is reported here.
    });
    await act(async () => {
      root = hydrateRoot(host, <Read />);
    });
    const reported = errors.mock.calls.map((call) => String(call[0]));
    errors.mockRestore();

    expect(reported).toEqual([]);
    rows(host).forEach((row, i) => expect(row).toBe(served[i]));
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });
});
