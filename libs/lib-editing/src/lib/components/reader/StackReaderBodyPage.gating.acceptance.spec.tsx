/**
 * Acceptance tests for DEV-837 item 4b, AC7 (gating in the main panel) and the
 * main panel's half of AC9.
 *
 * Written from the spec, not the implementation. The page is called through
 * the public `ssr` entry; the panel it hands its props to is drawn in the
 * browser, as a visitor of each role would see it. Only the network, the
 * session and Next's `notFound` are faked.
 */
import { act, fireEvent, render } from '@testing-library/react';
import type { ComponentProps, ReactElement } from 'react';

import { NavigationProvider } from '../shared/NavigationProvider';
import { StackReaderBodyPanel } from './StackReaderBodyPanel';
// The package's public server entry, `@eightyfourthousand/lib-editing/ssr`.
import { StackReaderBodyPage } from '../ssr';

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
// One object, as the App Router gives one for an unchanged query.
const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useSearchParams: jest.fn(() => mockSearchParams),
  useRouter: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
}));
// The placeholder's image needs Next's loader.
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  LotusPond: () => null,
}));

const BUILD_CLIENT = { name: 'build-client' };

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  BODY_MATTER_FILTER: 'body',
  createBuildGraphQLClient: jest.fn(() => BUILD_CLIENT),
  getTranslationBlocks: jest.fn(),
  getTranslationTitles: jest.fn(),
  getTranslationMetadataByUuid: jest.fn(),
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
}));

// The visitor's role, as the session reports it.
let mockSession: { claims: { role: string } } | null = null;
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
  getSession: jest.fn(async () => mockSession),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getTranslationBlocks: jest.Mock;
  getTranslationTitles: jest.Mock;
  getTranslationMetadataByUuid: jest.Mock;
};
const navigation = jest.requireMock('next/navigation') as {
  notFound: jest.Mock;
};

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const TITLES = [
  {
    uuid: 't1',
    type: 'mainTitle',
    language: 'en',
    title: 'The Gated Sutra Title',
  },
];

const BODY_BLOCKS = [
  {
    type: 'passage',
    attrs: { uuid: 'p0', alignments: { a: 'b' } },
    content: [{ type: 'paragraph' }],
  },
  { type: 'passage', attrs: { uuid: 'p1' }, content: [{ type: 'paragraph' }] },
];

beforeEach(() => {
  mockSession = null;
  navigation.notFound.mockClear();
  api.getTranslationBlocks
    .mockReset()
    .mockResolvedValue({ blocks: BODY_BLOCKS });
  api.getTranslationTitles.mockReset().mockResolvedValue(TITLES);
  api.getTranslationMetadataByUuid
    .mockReset()
    .mockResolvedValue({ publicationStatus: '1' });
});

type PanelElement = ReactElement<ComponentProps<typeof StackReaderBodyPanel>>;

const page = async (slug: string) =>
  (await StackReaderBodyPage({
    params: Promise.resolve({ slug }),
  })) as PanelElement;

const GATED = [
  ['an unpublished status (2)', { publicationStatus: '2' }],
  ['an unpublished status (0)', { publicationStatus: '0' }],
  ['a status that is absent', { publicationStatus: undefined }],
  ['metadata that cannot be read (null): it fails closed', null],
] as const;

describe.each(GATED)(
  'StackReaderBodyPage for a work with %s (4b AC7)',
  (_, work) => {
    beforeEach(() => api.getTranslationMetadataByUuid.mockResolvedValue(work));

    it('does not read the translation’s passages', async () => {
      await page(WORK);

      expect(api.getTranslationBlocks).not.toHaveBeenCalled();
    });

    it('gives the panel no passage data and marks the work unpublished', async () => {
      const panel = await page(WORK);

      expect(panel.type).toBe(StackReaderBodyPanel);
      expect(panel.props.body).toEqual([]);
      expect(panel.props.isPublished).toBe(false);
    });

    it('still reads the titles, and gives them to the panel', async () => {
      const panel = await page(WORK);

      expect(api.getTranslationTitles).toHaveBeenCalledWith(
        expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
      );
      expect(panel.props.titles).toEqual(TITLES);
    });
  },
);

describe('StackReaderBodyPage for a published work (4b AC7)', () => {
  it('reads the first 250 passages and gives the panel their alignments, as before', async () => {
    const panel = await page(WORK);

    expect(api.getTranslationBlocks).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: WORK, type: 'body', maxPassages: 250 }),
    );
    expect(panel.props.body).toEqual([
      { type: 'passage', attrs: { uuid: 'p0', alignments: { a: 'b' } } },
      { type: 'passage', attrs: { uuid: 'p1', alignments: {} } },
    ]);
    expect(panel.props.isPublished).toBe(true);
    expect(panel.props.titles).toEqual(TITLES);
  });
});

describe('StackReaderBodyPage for a slug that is not a uuid (4b AC9)', () => {
  it('calls notFound and reads nothing', async () => {
    await expect(page('toh1')).rejects.toThrow('NEXT_NOT_FOUND');

    expect(navigation.notFound).toHaveBeenCalled();
    expect(api.getTranslationBlocks).not.toHaveBeenCalled();
    expect(api.getTranslationTitles).not.toHaveBeenCalled();
    expect(api.getTranslationMetadataByUuid).not.toHaveBeenCalled();
  });
});

describe('the gated main panel, drawn in the browser (4b AC7)', () => {
  beforeAll(() => {
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

  /** The page's panel, as the route draws it for a gated work: no provider. */
  const drawGated = async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue({
      publicationStatus: '2',
    });
    const panel = await page(WORK);
    const view = await act(async () =>
      render(
        <NavigationProvider uuid={WORK}>
          <StackReaderBodyPanel {...panel.props} />
        </NavigationProvider>,
      ),
    );
    // The role resolves in an effect.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return view;
  };

  const tabContent = (container: Element, name: string) => {
    const trigger = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === name,
    );
    return container.querySelector(
      `[role="tabpanel"][aria-labelledby="${trigger?.id}"]`,
    );
  };

  const open = async (container: Element, name: string) => {
    const trigger = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === name,
    ) as HTMLElement;
    await act(async () => {
      fireEvent.mouseDown(trigger, { button: 0 });
      fireEvent.click(trigger);
    });
  };

  it.each([
    ['a reader', { claims: { role: 'reader' } }],
    ['a visitor with no session', null],
    ['an editor', { claims: { role: 'editor' } }],
    ['an admin', { claims: { role: 'admin' } }],
  ])(
    'shows the "unpublished" placeholder in the Translation tab to %s',
    async (_, session) => {
      mockSession = session;

      const { container } = await drawGated();

      const translation = tabContent(container, 'Translation');
      expect(translation?.textContent).toMatch(/not yet published/i);
      expect(translation?.querySelector('[data-stack-passage]')).toBeNull();
    },
  );

  it.each([
    ['a reader', { claims: { role: 'reader' } }],
    ['an editor', { claims: { role: 'editor' } }],
  ])(
    'draws no passages and no loading skeleton in the Front tab for %s',
    async (_, session) => {
      mockSession = session;

      const { container } = await drawGated();

      const front = tabContent(container, 'Front');
      expect(front).not.toBeNull();
      expect(front?.querySelector('[data-stack-passage]')).toBeNull();
      expect(front?.querySelector('[data-skeleton]')).toBeNull();
    },
  );

  it.each([
    ['a reader', { claims: { role: 'reader' } }],
    ['an editor', { claims: { role: 'editor' } }],
  ])('still shows the titles to %s', async (_, session) => {
    mockSession = session;

    const { container } = await drawGated();
    await open(container, 'Front');

    expect(container.textContent).toContain('The Gated Sutra Title');
  });
});
