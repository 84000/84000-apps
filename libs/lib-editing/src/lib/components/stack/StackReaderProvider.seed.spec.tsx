import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { addBookmark } from '@eightyfourthousand/data-access';

import { PassageStack } from './PassageStack';
import type { StackController } from './StackController';
import { StackReaderProvider } from './StackReaderProvider';
import type { StackReaderSeed } from './stack-seed';
import { useStackWork } from './stack-work-context';

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

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
}));

jest.mock('./bibliography-work', () => ({
  loadBibliographyWork: jest.fn(),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
};
const bibliographyWork = jest.requireMock('./bibliography-work') as {
  loadBibliographyWork: jest.Mock;
};

/** What a server read for a work with `count` translation passages. */
const seedOf = (count: number): StackReaderSeed => {
  const uuids = Array.from({ length: count }, (_, i) => `p${i}`);
  return {
    workUuid: 'w1',
    sections: [
      {
        tab: 'translation',
        page: {
          metas: uuids.map((uuid, i) => ({
            uuid,
            label: `1.${i + 1}`,
            type: 'translation',
          })),
          nextCursor: uuids[count - 1],
          hasMoreAfter: true,
          hasMoreBefore: false,
        },
        passages: uuids.map((uuid, i) => ({
          uuid,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `passage ${i} text` }],
            },
          ],
        })),
      },
    ],
  };
};

const Translation = () => {
  const view = useStackWork()?.controllerFor('translation');
  return view ? <PassageStack controller={view} /> : null;
};

const Reader = ({ seed }: { seed: StackReaderSeed }) => (
  <StackReaderProvider workUuid="w1" seed={seed}>
    <Translation />
  </StackReaderProvider>
);

/** The scroller a host gives the stack, sized as a browser would size it. */
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

let root: Root | null = null;

beforeAll(() => {
  global.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  clientGraphql.getPassageMetaPage.mockReset();
  clientGraphql.getTranslationBlocks.mockReset();
  bibliographyWork.loadBibliographyWork.mockReset().mockResolvedValue(null);
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

/** Draw on the "server", then take it over in the "browser". */
const serveThenHydrate = async (seed: StackReaderSeed) => {
  const host = scroller();
  host.innerHTML = renderToString(<Reader seed={seed} />);
  const served = rows(host);

  const errors = jest.spyOn(console, 'error').mockImplementation(() => {
    // Collected: a hydration mismatch is reported here.
  });
  await act(async () => {
    root = hydrateRoot(host, <Reader seed={seed} />);
  });
  const reported = errors.mock.calls.map((call) => String(call[0]));
  errors.mockRestore();
  return { host, served, reported };
};

describe('StackReaderProvider with a seed', () => {
  it('draws the seeded rows on the server, without a request', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Reader seed={seedOf(5)} />);

    expect(rows(container).map((row) => row.id)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
    expect(container.textContent).toContain('passage 4 text');
    expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
  });

  it('is taken over in the browser with the same rows, and no reload', async () => {
    const { host, served, reported } = await serveThenHydrate(seedOf(5));

    expect(reported).toEqual([]);
    // The very nodes the server drew: React adopted them rather than redrawing.
    const taken = rows(host);
    expect(taken).toHaveLength(served.length);
    taken.forEach((row, i) => expect(row).toBe(served[i]));
    // The sections came from the seed: nothing re-read their first page.
    expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
    expect(bibliographyWork.loadBibliographyWork).toHaveBeenCalledTimes(1);
  });

  it('keeps the views built in the first render, rather than rebuilding them', async () => {
    const seen = new Set<unknown>();
    const Probe = () => {
      seen.add(useStackWork()?.controllerFor('translation'));
      return null;
    };
    const tree = (
      <StackReaderProvider workUuid="w1" seed={seedOf(3)}>
        <Probe />
      </StackReaderProvider>
    );
    const host = scroller();
    host.innerHTML = renderToString(tree);
    seen.clear();

    await act(async () => {
      root = hydrateRoot(host, tree);
    });

    expect(seen.size).toBe(1);
    expect([...seen][0]).toBeTruthy();
  });

  it('shows bookmarks only after taking over, so hydration matches', async () => {
    addBookmark({
      type: 'translation',
      tab: 'translation',
      uuid: 'p1',
      label: '1.2',
      body: '',
    });
    const bookmarked = (host: Element) =>
      host.querySelector('#p1 svg') !== null;

    const host = scroller();
    host.innerHTML = renderToString(<Reader seed={seedOf(3)} />);
    expect(bookmarked(host)).toBe(false);

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {
      // Collected: a hydration mismatch is reported here.
    });
    await act(async () => {
      root = hydrateRoot(host, <Reader seed={seedOf(3)} />);
    });
    const reported = errors.mock.calls.map((call) => String(call[0]));
    errors.mockRestore();

    expect(reported).toEqual([]);
    expect(bookmarked(host)).toBe(true);
  });

  it('continues paging from the seeded cursor', async () => {
    clientGraphql.getPassageMetaPage.mockResolvedValue({
      metas: [{ uuid: 'p5', label: '1.6', type: 'translation' }],
      hasMoreAfter: false,
      hasMoreBefore: false,
    });
    const views: (StackController | null | undefined)[] = [];
    const Probe = () => {
      views.push(useStackWork()?.controllerFor('translation'));
      return null;
    };
    await act(async () => {
      root = hydrateRoot(
        scroller(),
        <StackReaderProvider workUuid="w1" seed={seedOf(5)}>
          <Probe />
        </StackReaderProvider>,
      );
    });
    // Scrolling to the end of the seeded run asks for the next page.
    await act(async () => views.at(-1)?.setVisibleRange({ start: 0, end: 5 }));

    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'p4' }),
    );
  });

  it('loads in the browser when the seed is for another work', async () => {
    clientGraphql.getPassageMetaPage.mockResolvedValue({
      metas: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    });
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <StackReaderProvider workUuid="w2" seed={seedOf(3)}>
        <Translation />
      </StackReaderProvider>,
    );
    expect(rows(container)).toEqual([]);
  });
});
