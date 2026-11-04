/**
 * Acceptance tests for DEV-837 item 4b, AC2 to AC4 (and the provider half of
 * AC9): a `StackReaderProvider` given a seed with a bibliography draws the
 * bibliography's first window on the server, virtualized, and the browser
 * keeps those rows without a request.
 *
 * Written from the spec, not the implementation. Only the network is faked.
 */
import { act } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { StackReaderProvider } from './StackReaderProvider';
import type { StackReaderSeed, StackSectionSeed } from './stack-seed';
import { StackTab } from './StackTab';
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
  getWorkBibliography: jest.fn(),
}));

const mockSupabase = { from: jest.fn(), rpc: jest.fn() };
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => mockSupabase),
  getBibliographyRows: jest.fn(async () => []),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getTranslationBlocksAround: jest.Mock;
  getWorkBibliography: jest.Mock;
};
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getBibliographyRows: jest.Mock;
};

type Section = {
  heading: string | null;
  label?: string;
  entries: { uuid: string; label?: string; html: string; workUuid?: string }[];
};

const WORK = 'w1';

/** A section of the other tabs, as `loadStackReaderSeed` reads one. */
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
      metas: uuids.map((uuid, i) => ({ uuid, label: `${i + 1}`, type })),
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

/** The seed `loadStackReaderSeed` returns once it carries the bibliography. */
const seedOf = (bibliography: Section[]) =>
  ({
    workUuid: WORK,
    sections: [
      section('front', 'introduction', 'front', 2),
      section('translation', 'translation', 'translation', 3),
      section('abbreviations', 'abbreviations', 'abbreviation', 1),
      section('endnotes', 'endnotes', 'endnote', 2),
    ],
    bibliography,
  }) as unknown as StackReaderSeed;

/** Two headed sections, as a work's bibliography reads. */
const BIBLIOGRAPHY: Section[] = [
  {
    heading: 'Tibetan Texts',
    label: '1',
    entries: [
      {
        uuid: 'e-1-1',
        label: '1.1',
        html: '<p><em>Kangyur</em> source alpha</p>',
        workUuid: 'w-a',
      },
      {
        uuid: 'e-1-2',
        label: '1.2',
        html: '<p>Kangyur source beta</p>',
        workUuid: 'w-b',
      },
    ],
  },
  {
    heading: 'Secondary Sources',
    label: '2',
    entries: [
      {
        uuid: 'e-2-1',
        label: '2.1',
        html: '<p>Secondary source gamma</p>',
        workUuid: 'w-c',
      },
    ],
  },
];

/** What the rows should read, in order, as `[label, text]`. */
const expectedRows = (bibliography: Section[]) =>
  bibliography.flatMap((part) => [
    ...(part.heading ? [[`b.${part.label}`, part.heading]] : []),
    ...part.entries.map((entry) => [
      `b.${entry.label}`,
      entry.html.replace(/<[^>]+>/g, ''),
    ]),
  ]);

const Reader = ({
  seed,
  tabs = ['bibliography'],
}: {
  seed: StackReaderSeed;
  tabs?: string[];
}) => (
  <StackReaderProvider workUuid={WORK} seed={seed}>
    {tabs.map((tab) => (
      <StackTab key={tab} tab={tab} />
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

const rowElements = (container: Element) =>
  Array.from(container.querySelectorAll('[data-stack-passage]'));

/** A row's label and its text without the label, as a reader sees them. */
const readRow = (row: Element): [string, string] => {
  const label = row.querySelector('[data-passage-label]');
  const labelText = label?.textContent?.trim() ?? '';
  const clone = row.cloneNode(true) as Element;
  clone.querySelector('[data-passage-label]')?.remove();
  return [labelText, (clone.textContent ?? '').replace(/\s+/g, ' ').trim()];
};

const serve = (seed: StackReaderSeed, tabs?: string[]) => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Reader seed={seed} tabs={tabs} />);
  return container;
};

const reads = () => [
  clientGraphql.getPassageMetaPage,
  clientGraphql.getTranslationBlocks,
  clientGraphql.getTranslationBlocksAround,
  clientGraphql.getWorkBibliography,
  dataAccess.getBibliographyRows,
  mockRequest,
  mockSupabase.from,
  mockSupabase.rpc,
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
  reads().forEach((read) => read.mockClear());
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

describe('the seeded bibliography, server-rendered (4b AC2)', () => {
  it('draws the rows in reading order: each heading, then its entries', () => {
    const container = serve(seedOf(BIBLIOGRAPHY));

    expect(rowElements(container).map(readRow)).toEqual(
      expectedRows(BIBLIOGRAPHY),
    );
  });

  it('labels headings and entries alike with `b.` and the label the read gave', () => {
    const container = serve(seedOf(BIBLIOGRAPHY));

    expect(
      rowElements(container).map(
        (row) => row.querySelector('[data-passage-label]')?.textContent,
      ),
    ).toEqual(['b.1', 'b.1.1', 'b.1.2', 'b.2', 'b.2.1']);
  });

  it('draws a row’s text from the entry’s html', () => {
    const container = serve(seedOf(BIBLIOGRAPHY));

    expect(container.textContent).toContain('Kangyur source alpha');
    expect(container.textContent).toContain('Secondary source gamma');
    // The markup is drawn, not shown as text.
    expect(container.textContent).not.toContain('<em>');
  });

  it('draws only the entries of a section whose heading is null', () => {
    const unheaded: Section[] = [
      {
        heading: null,
        label: '',
        entries: [
          { uuid: 'n1', label: '1', html: '<p>Lone source one</p>' },
          { uuid: 'n2', label: '2', html: '<p>Lone source two</p>' },
        ],
      },
    ];

    const container = serve(seedOf(unheaded));

    expect(rowElements(container).map(readRow)).toEqual([
      ['b.1', 'Lone source one'],
      ['b.2', 'Lone source two'],
    ]);
  });

  it('keeps the order of sections as given, headed or not', () => {
    const mixed: Section[] = [
      {
        heading: null,
        label: '',
        entries: [
          { uuid: 'm1', label: '1', html: '<p>Before any heading</p>' },
        ],
      },
      {
        heading: 'Late Heading',
        label: '2',
        entries: [{ uuid: 'm2', label: '2.1', html: '<p>After a heading</p>' }],
      },
    ];

    const container = serve(seedOf(mixed));

    expect(rowElements(container).map(readRow)).toEqual([
      ['b.1', 'Before any heading'],
      ['b.2', 'Late Heading'],
      ['b.2.1', 'After a heading'],
    ]);
  });

  it('draws it with no request, beside the other tabs’ rows', () => {
    const container = serve(seedOf(BIBLIOGRAPHY), [
      'translation',
      'bibliography',
    ]);

    const rows = rowElements(container);
    expect(
      rows.filter((row) => row.id.startsWith('translation-')),
    ).toHaveLength(3);
    expect(
      rows.filter((row) => !row.id.startsWith('translation-')).map(readRow),
    ).toEqual(expectedRows(BIBLIOGRAPHY));
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });
});

describe('a long seeded bibliography is virtualized (4b AC3)', () => {
  const LONG: Section[] = [0, 1].map((s) => ({
    heading: `Section ${s + 1} heading`,
    label: `${s + 1}`,
    entries: Array.from({ length: 200 }, (_, i) => ({
      uuid: `long-${s}-${i}`,
      label: `${s + 1}.${i + 1}`,
      html: `<p>Source ${s + 1}.${i + 1} text</p>`,
    })),
  }));

  it('draws at most 100 rows on the server', () => {
    const container = serve(seedOf(LONG));

    expect(rowElements(container).length).toBeLessThanOrEqual(100);
  });

  it('draws at least the first 10, starting with the first heading', () => {
    const container = serve(seedOf(LONG));

    const rows = rowElements(container).map(readRow);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.slice(0, 3)).toEqual([
      ['b.1', 'Section 1 heading'],
      ['b.1.1', 'Source 1.1 text'],
      ['b.1.2', 'Source 1.2 text'],
    ]);
    // Contiguous from the top: no gap in the window it draws.
    expect(rows.slice(0, 10)).toEqual(expectedRows(LONG).slice(0, 10));
  });
});

describe('the seeded bibliography, taken over in the browser (4b AC4)', () => {
  const serveThenHydrate = async (seed: StackReaderSeed, tabs?: string[]) => {
    const host = scroller();
    host.innerHTML = renderToString(<Reader seed={seed} tabs={tabs} />);
    const served = rowElements(host);

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {
      // Collected: a hydration mismatch is reported here.
    });
    await act(async () => {
      root = hydrateRoot(host, <Reader seed={seed} tabs={tabs} />);
    });
    const reported = errors.mock.calls.map((call) => String(call[0]));
    errors.mockRestore();
    return { host, served, reported };
  };

  it('hydrates with no mismatch, keeping the very row nodes the server drew', async () => {
    const { host, served, reported } = await serveThenHydrate(
      seedOf(BIBLIOGRAPHY),
    );

    expect(served).toHaveLength(5);
    expect(reported).toEqual([]);
    const taken = rowElements(host);
    expect(taken).toHaveLength(served.length);
    taken.forEach((row, i) => expect(row).toBe(served[i]));
    expect(taken.map(readRow)).toEqual(expectedRows(BIBLIOGRAPHY));
  });

  it('makes no request for the bibliography, or for anything seeded', async () => {
    const { host } = await serveThenHydrate(seedOf(BIBLIOGRAPHY), [
      'translation',
      'bibliography',
    ]);

    // Drawn, and kept, rather than absent for want of a read.
    expect(
      rowElements(host)
        .filter((row) => !row.id.startsWith('translation-'))
        .map(readRow),
    ).toEqual(expectedRows(BIBLIOGRAPHY));
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });

  it('hydrates a long, virtualized bibliography with no mismatch and no request', async () => {
    const long: Section[] = [
      {
        heading: 'Only heading',
        label: '1',
        entries: Array.from({ length: 400 }, (_, i) => ({
          uuid: `l-${i}`,
          label: `1.${i + 1}`,
          html: `<p>Entry ${i + 1}</p>`,
        })),
      },
    ];

    const { host, served, reported } = await serveThenHydrate(seedOf(long));

    expect(reported).toEqual([]);
    expect(served.length).toBeGreaterThanOrEqual(10);
    rowElements(host)
      .slice(0, served.length)
      .forEach((row, i) => expect(row).toBe(served[i]));
    reads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });
});

describe('the reader’s stack never reads the draft bibliography (4b AC9)', () => {
  it('does not call getBibliographyRows when seeded and taken over', async () => {
    const host = scroller();
    host.innerHTML = renderToString(<Reader seed={seedOf(BIBLIOGRAPHY)} />);
    await act(async () => {
      root = hydrateRoot(host, <Reader seed={seedOf(BIBLIOGRAPHY)} />);
    });

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
        <StackReaderProvider workUuid={WORK}>
          <Probe />
        </StackReaderProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
  });
});
