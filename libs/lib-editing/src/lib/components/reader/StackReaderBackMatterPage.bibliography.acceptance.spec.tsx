/**
 * Acceptance tests for DEV-837 item 4b, AC5 (the panel), AC8 (gating in the
 * right panel) and the right panel's half of AC9.
 *
 * Written from the spec, not the implementation. They call the page through
 * the public `ssr` entry, draw what it returns under a `StackReaderProvider`
 * seeded as `StackReaderLayout` would seed it, and fake only the network and
 * Next's `notFound`.
 */
import { act, render } from '@testing-library/react';
import type { ComponentType, ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

import { NavigationProvider } from '../shared/NavigationProvider';
import { StackReaderProvider } from '../stack/StackReaderProvider';
import type { StackReaderSeed, StackSectionSeed } from '../stack/stack-seed';
import { StackReaderBackMatterPanel } from './StackReaderBackMatterPanel';
// The package's public server entry, `@eightyfourthousand/lib-editing/ssr`.
import { StackReaderBackMatterPage } from '../ssr';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
jest.mock('server-only', () => ({}));
// The ssr entry also exports the metadata helpers, which load Next's OG image.
jest.mock('next/og', () => ({ ImageResponse: class {} }));
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
}));
// The footer's image needs Next's loader.
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  LotusPond: () => null,
}));

const BUILD_CLIENT = { name: 'build-client' };

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  createBuildGraphQLClient: jest.fn(() => BUILD_CLIENT),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationMetadataByUuid: jest.fn(),
  getWorkGlossaryTerms: jest.fn(),
  getWorkBibliography: jest.fn(),
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
  getWorkGlossaryTerms: jest.fn(),
  getWorkGlossaryTermsAround: jest.fn(),
  getWorkBibliography: jest.fn(),
}));
const mockSupabase = { from: jest.fn(), rpc: jest.fn() };
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => mockSupabase),
  getBibliographyRows: jest.fn(async () => []),
}));

const browserApi = jest.requireMock('@eightyfourthousand/client-graphql') as {
  createGraphQLClient: jest.Mock;
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getTranslationBlocksAround: jest.Mock;
  getWorkGlossaryTerms: jest.Mock;
  getWorkGlossaryTermsAround: jest.Mock;
  getWorkBibliography: jest.Mock;
};

const ssrApi = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getTranslationMetadataByUuid: jest.Mock;
  getWorkGlossaryTerms: jest.Mock;
  getWorkBibliography: jest.Mock;
};
const navigation = jest.requireMock('next/navigation') as {
  notFound: jest.Mock;
};
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getBibliographyRows: jest.Mock;
};

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

/** Which section types the work "has", as its limit-1 metadata read answers. */
let has: Record<string, boolean>;

const metaPageFor = (type: string) =>
  has[type]
    ? {
        metas: [{ uuid: `${type}-0`, label: '1', type }],
        nextCursor: `${type}-0`,
        hasMoreAfter: true,
        hasMoreBefore: false,
      }
    : { metas: [], hasMoreAfter: false, hasMoreBefore: false };

const glossaryPage = {
  terms: [
    {
      uuid: 'g1',
      authority: 'auth-1',
      workUuid: WORK,
      termNumber: 1,
      definition: 'glossary definition text',
      names: { english: 'Glossary term one' },
    },
  ],
  hasMoreAfter: false,
  hasMoreBefore: false,
  totalCount: 1,
};

type Section = {
  heading: string | null;
  label?: string;
  entries: { uuid: string; label?: string; html: string; workUuid?: string }[];
};

/** The bibliography the layout's seed carries. */
const SEEDED: Section[] = [
  {
    heading: 'Seeded Heading',
    label: '1',
    entries: [
      { uuid: 'b1', label: '1.1', html: '<p>Seeded source one</p>' },
      { uuid: 'b2', label: '1.2', html: '<p>Seeded source two</p>' },
    ],
  },
];

/** What the page must not draw from its own read: a bibliography only a read could carry. */
const DECOY: Section[] = [
  {
    heading: 'Decoy Heading',
    label: '1',
    entries: [{ uuid: 'd1', label: '1.1', html: '<p>Decoy source</p>' }],
  },
];

beforeEach(() => {
  has = { endnotes: true, abbreviations: true };
  navigation.notFound.mockClear();
  dataAccess.getBibliographyRows.mockClear();
  ssrApi.getPassageMetaPage
    .mockReset()
    .mockImplementation(async ({ type }) => metaPageFor(type));
  ssrApi.getTranslationBlocks
    .mockReset()
    .mockResolvedValue({ blocks: [], hasMoreAfter: false });
  ssrApi.getTranslationMetadataByUuid
    .mockReset()
    .mockResolvedValue({ publicationStatus: '1' });
  ssrApi.getWorkGlossaryTerms.mockReset().mockResolvedValue(glossaryPage);
  ssrApi.getWorkBibliography.mockReset().mockResolvedValue(DECOY);
});

/** What the page's provider holds: the endnotes and abbreviations, drawn. */
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

const seedOf = (bibliography: Section[]) =>
  ({
    workUuid: WORK,
    sections: [
      section('front', 'introduction', 'front', 1),
      section('translation', 'translation', 'translation', 1),
      section('abbreviations', 'abbreviations', 'abbreviation', 2),
      section('endnotes', 'endnotes', 'endnote', 3),
    ],
    bibliography,
  }) as unknown as StackReaderSeed;

const page = async (slug: string) =>
  (await StackReaderBackMatterPage({
    params: Promise.resolve({ slug }),
  })) as ReactElement | null;

/** What the panel is drawn from: `bibliography` is no longer a prop. */
type PanelProps = {
  workUuid: string;
  glossary: unknown;
  hasEndnotes: boolean;
  hasAbbreviations: boolean;
  withAttestations?: boolean;
};
const Panel =
  StackReaderBackMatterPanel as unknown as ComponentType<PanelProps>;

/** The page drawn on a server, under the layout's provider. */
const draw = async (bibliography: Section[] = SEEDED) => {
  const element = await page(WORK);
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <StackReaderProvider workUuid={WORK} seed={seedOf(bibliography)}>
      {element}
    </StackReaderProvider>,
  );
  return container;
};

const tabNames = (container: Element) =>
  Array.from(container.querySelectorAll('[role="tab"]')).map((tab) =>
    tab.textContent?.trim(),
  );

/** The content of one tab, found through its trigger. */
const tabContent = (container: Element, name: string) => {
  const trigger = Array.from(container.querySelectorAll('[role="tab"]')).find(
    (tab) => tab.textContent?.trim() === name,
  );
  if (!trigger?.id) return null;
  return container.querySelector(
    `[role="tabpanel"][aria-labelledby="${trigger.id}"]`,
  );
};

const readRow = (row: Element): [string, string] => {
  const labelText =
    row.querySelector('[data-passage-label]')?.textContent?.trim() ?? '';
  const clone = row.cloneNode(true) as Element;
  clone.querySelector('[data-passage-label]')?.remove();
  return [labelText, (clone.textContent ?? '').replace(/\s+/g, ' ').trim()];
};

const SEEDED_ROWS = [
  ['b.1', 'Seeded Heading'],
  ['b.1.1', 'Seeded source one'],
  ['b.1.2', 'Seeded source two'],
];

describe('StackReaderBackMatterPage for a published work (4b AC5)', () => {
  it('no longer reads the bibliography itself', async () => {
    await page(WORK);

    expect(ssrApi.getWorkBibliography).not.toHaveBeenCalled();
    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
  });

  it('still reads the glossary, and makes the limit-1 Notes and Abbr checks', async () => {
    await page(WORK);

    expect(ssrApi.getWorkGlossaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
    for (const type of ['endnotes', 'abbreviations']) {
      expect(ssrApi.getPassageMetaPage).toHaveBeenCalledWith(
        expect.objectContaining({
          client: BUILD_CLIENT,
          uuid: WORK,
          type,
          limit: 1,
        }),
      );
    }
  });

  it('gives the client panel exactly workUuid, glossary, hasEndnotes, hasAbbreviations and withAttestations', async () => {
    const element = (await page(WORK)) as ReactElement<Record<string, unknown>>;

    expect(element.type).toBe(StackReaderBackMatterPanel);
    expect(Object.keys(element.props).sort()).toEqual([
      'glossary',
      'hasAbbreviations',
      'hasEndnotes',
      'withAttestations',
      'workUuid',
    ]);
    expect(element.props.workUuid).toBe(WORK);
    expect(element.props.glossary).toEqual(glossaryPage);
    expect(element.props.hasEndnotes).toBe(true);
    expect(element.props.hasAbbreviations).toBe(true);
    expect(typeof element.props.withAttestations).toBe('boolean');
  });

  it('draws the Biblio tab from the seed’s stack, not from a read', async () => {
    const container = await draw();

    expect(tabNames(container)).toEqual([
      'Notes',
      'Glossary',
      'Biblio',
      'Abbr',
    ]);
    const biblio = tabContent(container, 'Biblio');
    expect(biblio).not.toBeNull();
    expect(
      Array.from(biblio?.querySelectorAll('[data-stack-passage]') ?? []).map(
        readRow,
      ),
    ).toEqual(SEEDED_ROWS);
    expect(container.textContent).not.toContain('Decoy');
  });

  it('keeps Notes and Abbr drawn as stacks beside it', async () => {
    const container = await draw();

    const ids = Array.from(
      container.querySelectorAll('[data-stack-passage]'),
    ).map((row) => row.id);
    expect(ids.filter((id) => id.startsWith('endnotes-'))).toHaveLength(3);
    expect(ids.filter((id) => id.startsWith('abbreviations-'))).toHaveLength(2);
    expect(container.textContent).toContain('Glossary term one');
  });

  it('hides the Biblio tab when the seed’s bibliography is empty, as the paginated panel does', async () => {
    const container = await draw([]);

    expect(tabNames(container)).toEqual(['Notes', 'Glossary', 'Abbr']);
    expect(container.textContent).not.toContain('Decoy');
  });

  it('shows the paginated panel’s other tabs as before: no Abbr or Notes when the work has none', async () => {
    has = {};

    const container = await draw();

    expect(tabNames(container)).toEqual(['Glossary', 'Biblio']);
  });
});

describe('StackReaderBackMatterPanel (4b AC5)', () => {
  const panelProps: PanelProps = {
    workUuid: WORK,
    glossary: glossaryPage,
    hasEndnotes: true,
    hasAbbreviations: false,
    withAttestations: false,
  };

  // jsdom lays nothing out, so the scroller a stack virtualizes against has a
  // zero rect and draws no rows, in any tab. Give every element the size a
  // browser would, as the stack specs do for their scrollers.
  const proto = HTMLElement.prototype;
  const restore: (() => void)[] = [];
  const stub = (name: 'offsetWidth' | 'offsetHeight', value: number) => {
    const original = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, {
      configurable: true,
      get: () => value,
    });
    restore.push(() => {
      if (original) Object.defineProperty(proto, name, original);
      else delete (proto as unknown as Record<string, unknown>)[name];
    });
  };

  beforeAll(() => {
    stub('offsetWidth', 800);
    stub('offsetHeight', 1200);
    const rect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 800,
        bottom: 1200,
        width: 800,
        height: 1200,
        toJSON: () => ({}),
      }) as DOMRect;
    restore.push(() => {
      proto.getBoundingClientRect = rect;
    });
    global.ResizeObserver = class {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof ResizeObserver;
    global.IntersectionObserver = class {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
      takeRecords = jest.fn(() => []);
    } as unknown as typeof IntersectionObserver;
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  afterAll(() => restore.reverse().forEach((undo) => undo()));

  const mount = (bibliography: Section[]) =>
    act(async () =>
      render(
        <NavigationProvider uuid={WORK}>
          <StackReaderProvider workUuid={WORK} seed={seedOf(bibliography)}>
            <Panel {...panelProps} />
          </StackReaderProvider>
        </NavigationProvider>,
      ),
    );

  const browserReads = () => [
    browserApi.getPassageMetaPage,
    browserApi.getTranslationBlocks,
    browserApi.getTranslationBlocksAround,
    browserApi.getWorkBibliography,
    dataAccess.getBibliographyRows,
    mockSupabase.from,
    mockSupabase.rpc,
  ];

  beforeEach(() => {
    browserReads().forEach((read) => read.mockClear());
  });

  it('draws the Biblio tab’s rows from the provider’s seed when drawn in the browser', async () => {
    const view = await mount(SEEDED);

    const biblio = tabContent(view.container, 'Biblio');
    expect(biblio).not.toBeNull();
    expect(
      Array.from(biblio?.querySelectorAll('[data-stack-passage]') ?? []).map(
        readRow,
      ),
    ).toEqual(SEEDED_ROWS);
  });

  it('makes no bibliography read in the browser to draw it', async () => {
    const view = await mount(SEEDED);

    expect(
      tabContent(view.container, 'Biblio')?.querySelectorAll(
        '[data-stack-passage]',
      ).length,
    ).toBeGreaterThan(0);
    browserReads().forEach((read) => expect(read).not.toHaveBeenCalled());
  });

  it('draws the Notes tab’s rows under the same harness, so the harness is not the limit', async () => {
    const view = await mount(SEEDED);

    const notes = tabContent(view.container, 'Notes');
    expect(notes).not.toBeNull();
    expect(
      Array.from(notes?.querySelectorAll('[data-stack-passage]') ?? []).map(
        (row) => row.id,
      ),
    ).toEqual(['endnotes-0', 'endnotes-1', 'endnotes-2']);
    expect(notes?.textContent).toContain('endnote 2 text');
  });

  it('hides the Biblio tab when the seed has no bibliography', async () => {
    const view = await act(async () =>
      render(
        <NavigationProvider uuid={WORK}>
          <StackReaderProvider workUuid={WORK} seed={seedOf([])}>
            <Panel {...panelProps} />
          </StackReaderProvider>
        </NavigationProvider>,
      ),
    );

    expect(tabNames(view.container)).not.toContain('Biblio');
  });
});

describe('StackReaderBackMatterPage for a work that is not published (4b AC8)', () => {
  it.each([
    ['unpublished status 2', { publicationStatus: '2' }],
    ['unpublished status 0', { publicationStatus: '0' }],
    ['no publication status', { publicationStatus: undefined }],
    ['unreadable metadata (null)', null],
  ])('renders nothing, and reads only the metadata: %s', async (_, work) => {
    ssrApi.getTranslationMetadataByUuid.mockResolvedValue(work);

    const element = await page(WORK);

    expect(element).toBeNull();
    expect(ssrApi.getTranslationMetadataByUuid).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
    expect(ssrApi.getWorkGlossaryTerms).not.toHaveBeenCalled();
    expect(ssrApi.getWorkBibliography).not.toHaveBeenCalled();
    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
    // The Notes and Abbr checks, and any passage read.
    expect(ssrApi.getPassageMetaPage).not.toHaveBeenCalled();
    expect(ssrApi.getTranslationBlocks).not.toHaveBeenCalled();
  });

  it('draws nothing at all for it', async () => {
    ssrApi.getTranslationMetadataByUuid.mockResolvedValue({
      publicationStatus: '2',
    });

    const container = await draw();

    expect(container.innerHTML).toBe('');
  });
});

describe('StackReaderBackMatterPage for a slug that is not a uuid (4b AC9)', () => {
  it('calls notFound and reads nothing', async () => {
    await expect(page('toh1')).rejects.toThrow('NEXT_NOT_FOUND');

    expect(navigation.notFound).toHaveBeenCalled();
    expect(ssrApi.getTranslationMetadataByUuid).not.toHaveBeenCalled();
    expect(ssrApi.getPassageMetaPage).not.toHaveBeenCalled();
    expect(ssrApi.getTranslationBlocks).not.toHaveBeenCalled();
    expect(ssrApi.getWorkGlossaryTerms).not.toHaveBeenCalled();
    expect(ssrApi.getWorkBibliography).not.toHaveBeenCalled();
  });
});
