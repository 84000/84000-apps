/**
 * Acceptance tests for DEV-837 item 4a, AC2: `StackReaderBackMatterPage`, the
 * right panel for stacks.
 *
 * Written from the spec, not the implementation. They call the page through
 * the public `ssr` entry, draw what it returns under a `StackReaderProvider`
 * seeded as `StackReaderLayout` would seed it, and fake only the network and
 * Next's `notFound`.
 */
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

import { StackReaderProvider } from '../stack/StackReaderProvider';
import type { StackReaderSeed, StackSectionSeed } from '../stack/stack-seed';
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
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
}));

const ssrApi = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getWorkGlossaryTerms: jest.Mock;
  getWorkBibliography: jest.Mock;
};
const navigation = jest.requireMock('next/navigation') as {
  notFound: jest.Mock;
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

const bibliography = [
  {
    heading: 'Bibliography heading',
    entries: [{ uuid: 'b1', label: '1', html: '<p>A cited source</p>' }],
  },
];

beforeEach(() => {
  has = { endnotes: true, abbreviations: true };
  navigation.notFound.mockClear();
  ssrApi.getPassageMetaPage
    .mockReset()
    .mockImplementation(async ({ type }) => metaPageFor(type));
  ssrApi.getTranslationBlocks
    .mockReset()
    .mockResolvedValue({ blocks: [], hasMoreAfter: false });
  ssrApi.getWorkGlossaryTerms.mockReset().mockResolvedValue(glossaryPage);
  ssrApi.getWorkBibliography.mockReset().mockResolvedValue(bibliography);
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

const seed: StackReaderSeed = {
  workUuid: WORK,
  sections: [
    section('front', 'introduction', 'front', 1),
    section('translation', 'translation', 'translation', 1),
    section('abbreviations', 'abbreviations', 'abbreviation', 2),
    section('endnotes', 'endnotes', 'endnote', 3),
  ],
};

const page = async (slug: string) =>
  (await StackReaderBackMatterPage({
    params: Promise.resolve({ slug }),
  })) as ReactElement;

/** The page drawn on a server, under the layout's provider. */
const draw = async () => {
  const element = await page(WORK);
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <StackReaderProvider workUuid={WORK} seed={seed}>
      {element}
    </StackReaderProvider>,
  );
  return container;
};

const tabNames = (container: Element) =>
  Array.from(container.querySelectorAll('[role="tab"]')).map((tab) =>
    tab.textContent?.trim(),
  );

const rows = (container: Element) =>
  Array.from(container.querySelectorAll('[data-stack-passage]')).map(
    (row) => row.id,
  );

describe('StackReaderBackMatterPage (AC2)', () => {
  it('is exported from the ssr entry as a function', () => {
    expect(typeof StackReaderBackMatterPage).toBe('function');
  });

  it('shows the paginated panel’s tabs when the work has every section', async () => {
    const container = await draw();

    expect(tabNames(container)).toEqual([
      'Notes',
      'Glossary',
      'Biblio',
      'Abbr',
    ]);
  });

  it('draws Notes and Abbreviations as stacks from the provider above, in server HTML', async () => {
    const container = await draw();

    expect(rows(container).filter((id) => id.startsWith('endnotes-'))).toEqual([
      'endnotes-0',
      'endnotes-1',
      'endnotes-2',
    ]);
    expect(
      rows(container).filter((id) => id.startsWith('abbreviations-')),
    ).toEqual(['abbreviations-0', 'abbreviations-1']);
    expect(container.textContent).toContain('endnote 2 text');
    expect(container.textContent).toContain('abbreviation 1 text');
  });

  it('reads the glossary and the bibliography for the work, and draws them as the paginated panel does', async () => {
    const container = await draw();

    expect(ssrApi.getWorkGlossaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
    expect(ssrApi.getWorkBibliography).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
    expect(container.textContent).toContain('Glossary term one');
    expect(container.textContent).toContain('Bibliography heading');
    expect(container.textContent).toContain('A cited source');
  });

  it('finds out whether Notes and Abbreviations exist with a limit-1 metadata read', async () => {
    await page(WORK);

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

  it('reads no passage content for the stacked tabs', async () => {
    await page(WORK);

    // The stacks read their own content, from the provider's seed.
    for (const [args] of ssrApi.getTranslationBlocks.mock.calls) {
      expect(['endnotes', 'abbreviations']).not.toContain(args.type);
    }
  });

  it('shows no Abbr tab when the work has no abbreviations', async () => {
    has.abbreviations = false;

    const container = await draw();

    expect(tabNames(container)).toEqual(['Notes', 'Glossary', 'Biblio']);
  });

  it('shows no Notes tab when the work has no endnotes', async () => {
    has.endnotes = false;

    const container = await draw();

    expect(tabNames(container)).toEqual(['Glossary', 'Biblio', 'Abbr']);
  });

  it('shows neither when the work has neither', async () => {
    has = {};

    const container = await draw();

    expect(tabNames(container)).toEqual(['Glossary', 'Biblio']);
  });

  it('shows no Biblio tab when the work has no bibliography, as the paginated panel does not', async () => {
    ssrApi.getWorkBibliography.mockResolvedValue([]);

    const container = await draw();

    expect(tabNames(container)).toEqual(['Notes', 'Glossary', 'Abbr']);
  });

  it('for a slug that is not a uuid, calls notFound and reads nothing', async () => {
    await expect(page('toh1')).rejects.toThrow('NEXT_NOT_FOUND');

    expect(navigation.notFound).toHaveBeenCalled();
    expect(ssrApi.getPassageMetaPage).not.toHaveBeenCalled();
    expect(ssrApi.getTranslationBlocks).not.toHaveBeenCalled();
    expect(ssrApi.getWorkGlossaryTerms).not.toHaveBeenCalled();
    expect(ssrApi.getWorkBibliography).not.toHaveBeenCalled();
  });
});
