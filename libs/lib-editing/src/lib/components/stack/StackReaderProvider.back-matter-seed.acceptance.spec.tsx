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
import {
  STACK_SECTIONS,
  type StackReaderSeed,
  type StackSectionSeed,
} from './stack-seed';
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
  getBibliographyRows: jest.fn(async () => []),
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
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getBibliographyRows: jest.Mock;
};

/** What a server read for one section, whose passages read "<name> <i> text". */
const section = (
  tab: string,
  type: string,
  name: string,
  count: number,
): StackSectionSeed => {
  const uuids = Array.from({ length: count }, (_, i) => `${tab}-${i}`);
  return {
    tab,
    page: {
      metas: uuids.map((uuid, i) => ({
        uuid,
        label: `${i + 1}`,
        type,
      })),
      nextCursor: uuids[count - 1],
      hasMoreAfter: false,
      hasMoreBefore: false,
    } as StackSectionSeed['page'],
    passages: uuids.map((uuid, i) => ({
      uuid,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: `${name} ${i} text` }],
        },
      ],
    })),
  };
};

const seed: StackReaderSeed = {
  workUuid: 'w1',
  sections: [
    section('front', 'introduction', 'front', 2),
    section('translation', 'translation', 'translation', 4),
    section('abbreviations', 'abbreviations', 'abbreviation', 2),
    section('endnotes', 'endnotes', 'endnote', 5),
  ],
};

const Stack = ({ tab }: { tab: string }) => {
  const view = useStackWork()?.controllerFor(tab);
  return view ? <PassageStack controller={view} /> : null;
};

const Reader = ({ tabs }: { tabs: string[] }) => (
  <StackReaderProvider workUuid="w1" seed={seed}>
    {tabs.map((tab) => (
      <Stack key={tab} tab={tab} />
    ))}
  </StackReaderProvider>
);

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
  dataAccess.getBibliographyRows.mockClear();
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

/** Draw on the "server", then take it over in the "browser". */
const serveThenHydrate = async (tabs: string[]) => {
  const host = scroller();
  host.innerHTML = renderToString(<Reader tabs={tabs} />);
  const served = rows(host);

  const errors = jest.spyOn(console, 'error').mockImplementation(() => {
    // Collected: a hydration mismatch is reported here.
  });
  await act(async () => {
    root = hydrateRoot(host, <Reader tabs={tabs} />);
  });
  const reported = errors.mock.calls.map((call) => String(call[0]));
  errors.mockRestore();
  return { host, served, reported };
};

describe('StackReaderProvider seeded with the back matter (AC4)', () => {
  it('draws the endnotes tab’s first window on the server, without a request', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Reader tabs={['endnotes']} />);

    expect(rows(container).map((row) => row.id)).toEqual([
      'endnotes-0',
      'endnotes-1',
      'endnotes-2',
      'endnotes-3',
      'endnotes-4',
    ]);
    for (let i = 0; i < 5; i++) {
      expect(container.textContent).toContain(`endnote ${i} text`);
    }
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });

  it('draws the translation’s window too, and each stack holds only its own rows', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <Reader tabs={['translation', 'endnotes']} />,
    );

    const ids = rows(container).map((row) => row.id);
    expect(ids.filter((id) => id.startsWith('translation-'))).toEqual([
      'translation-0',
      'translation-1',
      'translation-2',
      'translation-3',
    ]);
    expect(ids.filter((id) => id.startsWith('endnotes-'))).toHaveLength(5);
    expect(ids).toHaveLength(9);
    expect(container.textContent).toContain('translation 3 text');
    expect(container.textContent).toContain('endnote 4 text');
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });

  it('draws the abbreviations tab the same way', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Reader tabs={['abbreviations']} />);

    expect(rows(container).map((row) => row.id)).toEqual([
      'abbreviations-0',
      'abbreviations-1',
    ]);
    expect(container.textContent).toContain('abbreviation 1 text');
  });

  it('is taken over in the browser with no mismatch, the same row nodes and no request', async () => {
    const { host, served, reported } = await serveThenHydrate([
      'translation',
      'endnotes',
    ]);

    expect(served).toHaveLength(9);
    expect(reported).toEqual([]);
    // The very nodes the server drew: React adopted them rather than redrawing.
    const taken = rows(host);
    expect(taken).toHaveLength(served.length);
    taken.forEach((row, i) => expect(row).toBe(served[i]));
    // Nothing re-read the seeded passages, or the sections' first pages.
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });

  it('takes over the endnotes stack alone just as cleanly', async () => {
    const { host, served, reported } = await serveThenHydrate(['endnotes']);

    expect(served).toHaveLength(5);
    expect(reported).toEqual([]);
    rows(host).forEach((row, i) => expect(row).toBe(served[i]));
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
    expect(host.textContent).toContain('endnote 4 text');
  });
});

describe('the reader never reads the bibliography through the stack (AC6)', () => {
  it('does not call getBibliographyRows when seeded and taken over', async () => {
    await serveThenHydrate(['translation', 'endnotes']);

    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
  });

  it('does not call getBibliographyRows when loading in the browser without a seed', async () => {
    clientGraphql.getPassageMetaPage.mockResolvedValue({
      metas: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    });
    const views: unknown[] = [];
    const Probe = () => {
      views.push(useStackWork()?.controllerFor('bibliography'));
      return null;
    };
    await act(async () => {
      root = hydrateRoot(
        scroller(),
        <StackReaderProvider workUuid="w1">
          <Probe />
        </StackReaderProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalled();
    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
    // And so it draws no stack for the bibliography.
    expect(views.every((view) => !view)).toBe(true);
  });
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
