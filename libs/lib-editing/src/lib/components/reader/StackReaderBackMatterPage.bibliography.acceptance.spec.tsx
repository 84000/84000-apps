/**
 * Acceptance tests for DEV-837 item 4b, AC5 (the panel): the right panel draws
 * its Biblio tab from the seed of the `StackReaderProvider` above it.
 *
 * Written from the spec, not the implementation. Only the network is faked.
 */
import { act, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { NavigationProvider } from '../shared/NavigationProvider';
import { StackReaderProvider } from '../stack/StackReaderProvider';
import type { StackReaderSeed, StackSectionSeed } from '../stack/stack-seed';
import { StackReaderBackMatterPanel } from './StackReaderBackMatterPanel';

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

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getBibliographyRows: jest.Mock;
};

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

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
});
