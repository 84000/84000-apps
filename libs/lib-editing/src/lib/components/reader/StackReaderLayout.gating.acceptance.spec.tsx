/**
 * Acceptance tests for DEV-837 item 4b, AC6 (gating in the layout) and the
 * layout's half of AC9.
 *
 * Written from the spec, not the implementation. They drive the component
 * through the public `ssr` entry and fake only the network (the build GraphQL
 * client and its reads) and Next's `notFound`.
 */
import type { ReactElement, ReactNode } from 'react';

import { StackReaderProvider } from '../stack/StackReaderProvider';
import { STACK_SECTIONS } from '../stack/stack-seed';
import { ReaderLayout } from './ReaderLayout';
// The package's public server entry, `@eightyfourthousand/lib-editing/ssr`.
import { StackReaderLayout } from '../ssr';

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

const BUILD_CLIENT = { name: 'build-client' };

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql/ssr'),
  createBuildGraphQLClient: jest.fn(() => BUILD_CLIENT),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationMetadataByUuid: jest.fn(),
  getWorkBibliography: jest.fn(),
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getBibliographyRows: jest.fn(async () => []),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  createBuildGraphQLClient: jest.Mock;
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
  getTranslationMetadataByUuid: jest.Mock;
  getWorkBibliography: jest.Mock;
};
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getBibliographyRows: jest.Mock;
};

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const BIBLIOGRAPHY = [
  {
    heading: 'Seeded Heading',
    label: '1',
    entries: [
      { uuid: 'b1', label: '1.1', html: '<p>Seeded source</p>', workUuid: 'w' },
    ],
  },
];

const metaPage = (type: string) => ({
  metas: [{ uuid: `${type}-1`, label: '1', type }],
  nextCursor: `${type}-1`,
  hasMoreAfter: false,
  hasMoreBefore: false,
});

beforeEach(() => {
  api.createBuildGraphQLClient.mockClear();
  dataAccess.getBibliographyRows.mockClear();
  api.getTranslationMetadataByUuid
    .mockReset()
    .mockResolvedValue({ publicationStatus: '1' });
  api.getPassageMetaPage
    .mockReset()
    .mockImplementation(async ({ type }) => metaPage(type));
  api.getTranslationBlocks.mockReset().mockImplementation(async ({ type }) => ({
    blocks: [
      {
        type: 'passage',
        attrs: { uuid: `${type}-1` },
        content: [{ type: 'paragraph' }],
      },
    ],
  }));
  api.getWorkBibliography.mockReset().mockResolvedValue(BIBLIOGRAPHY);
});

type Layout = ReactElement<Record<string, unknown>>;

/** Every element in a tree, outermost first. */
const elementsIn = (node: ReactNode): Layout[] => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elementsIn);
  const element = node as Layout;
  return [element, ...elementsIn(element.props?.children as ReactNode)];
};

/** Whether a value, or anything inside it, is the given marker string. */
const mentions = (value: unknown, marker: string): boolean =>
  JSON.stringify(value, (_, v) =>
    typeof v === 'function' ? undefined : v,
  )?.includes(marker) ?? false;

const slots = {
  left: <div data-slot="left" />,
  main: <div data-slot="main" />,
  right: <div data-slot="right" />,
};
const initialToh = { toh: 'toh1', uuid: 'toh-1' } as never;

const layout = async (slug: string, params = Promise.resolve({ slug })) =>
  (await StackReaderLayout({
    params,
    ...slots,
    initialToh,
  })) as Layout;

const noWorkRead = () => {
  expect(api.getPassageMetaPage).not.toHaveBeenCalled();
  expect(api.getTranslationBlocks).not.toHaveBeenCalled();
  expect(api.getWorkBibliography).not.toHaveBeenCalled();
  expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
};

describe('StackReaderLayout for a published work (4b AC6)', () => {
  it('reads the work’s metadata with the build client and the slug', async () => {
    await layout(WORK);

    expect(api.getTranslationMetadataByUuid).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
  });

  it('behaves as before: one seed read, one provider, ReaderLayout inside', async () => {
    const element = await layout(WORK);

    expect(element.type).toBe(StackReaderProvider);
    expect(element.props.workUuid).toBe(WORK);
    expect(
      elementsIn(element).filter(({ type }) => type === StackReaderProvider),
    ).toHaveLength(1);
    expect(
      elementsIn(element).filter(({ type }) => type === ReaderLayout),
    ).toHaveLength(1);
    expect(api.getPassageMetaPage).toHaveBeenCalledTimes(STACK_SECTIONS.length);
    const seed = element.props.seed as { workUuid: string };
    expect(seed.workUuid).toBe(WORK);
  });

  it('seeds the bibliography the work reads, in a single read', async () => {
    const element = await layout(WORK);

    const seed = element.props.seed as { bibliography: unknown };
    expect(seed.bibliography).toEqual(BIBLIOGRAPHY);
    expect(api.getWorkBibliography).toHaveBeenCalledTimes(1);
    expect(api.getWorkBibliography).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
    expect(dataAccess.getBibliographyRows).not.toHaveBeenCalled();
  });

  it('forwards every ReaderLayout prop unchanged', async () => {
    const params = Promise.resolve({ slug: WORK });
    const element = await layout(WORK, params);
    const [inner] = elementsIn(element.props.children as ReactNode).filter(
      ({ type }) => type === ReaderLayout,
    );

    expect(inner.props.left).toBe(slots.left);
    expect(inner.props.main).toBe(slots.main);
    expect(inner.props.right).toBe(slots.right);
    expect(inner.props.initialToh).toBe(initialToh);
    await expect(inner.props.params).resolves.toEqual({ slug: WORK });
  });
});

describe.each([
  ['an unpublished status (2)', { publicationStatus: '2' }],
  ['an unpublished status (0)', { publicationStatus: '0' }],
  ['a status that is absent', { publicationStatus: undefined }],
  ['metadata that cannot be read (null): it fails closed', null],
])('StackReaderLayout for a work with %s (4b AC6)', (_, work) => {
  beforeEach(() => api.getTranslationMetadataByUuid.mockResolvedValue(work));

  it('renders ReaderLayout directly, with every prop forwarded', async () => {
    const params = Promise.resolve({ slug: WORK });

    const element = await layout(WORK, params);

    expect(element.type).toBe(ReaderLayout);
    expect(element.props.left).toBe(slots.left);
    expect(element.props.main).toBe(slots.main);
    expect(element.props.right).toBe(slots.right);
    expect(element.props.initialToh).toBe(initialToh);
    await expect(element.props.params).resolves.toEqual({ slug: WORK });
  });

  it('puts no StackReaderProvider and no seed anywhere in the tree', async () => {
    const element = await layout(WORK);

    expect(
      elementsIn(element).some(({ type }) => type === StackReaderProvider),
    ).toBe(false);
    expect(elementsIn(element).some(({ props }) => 'seed' in props)).toBe(
      false,
    );
    // Nothing of the work's passages or bibliography is in the payload.
    expect(mentions(element.props, 'Seeded Heading')).toBe(false);
    expect(mentions(element.props, `${STACK_SECTIONS[0].type}-1`)).toBe(false);
  });

  it('reads no passage and no bibliography, only the metadata', async () => {
    await layout(WORK);

    expect(api.getTranslationMetadataByUuid).toHaveBeenCalledWith(
      expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
    );
    noWorkRead();
  });
});

describe('StackReaderLayout for a slug that is not a uuid (4b AC9)', () => {
  it('reads nothing, metadata included, and renders ReaderLayout directly', async () => {
    const params = Promise.resolve({ slug: 'toh1' });

    const element = await layout('toh1', params);

    expect(element.type).toBe(ReaderLayout);
    expect(
      elementsIn(element).some(({ type }) => type === StackReaderProvider),
    ).toBe(false);
    expect(element.props.left).toBe(slots.left);
    expect(element.props.main).toBe(slots.main);
    expect(element.props.right).toBe(slots.right);
    expect(element.props.initialToh).toBe(initialToh);
    await expect(element.props.params).resolves.toEqual({ slug: 'toh1' });
    expect(api.getTranslationMetadataByUuid).not.toHaveBeenCalled();
    noWorkRead();
  });
});
