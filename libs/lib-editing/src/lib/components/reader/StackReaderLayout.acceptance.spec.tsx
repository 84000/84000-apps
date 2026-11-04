/**
 * Acceptance tests for DEV-837 item 4a, AC1: `StackReaderLayout`.
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
  getTranslationMetadataByUuid: jest.fn(async () => ({
    publicationStatus: '1',
  })),
  getWorkBibliography: jest.fn(async () => []),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  createBuildGraphQLClient: jest.Mock;
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
};

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const metaPage = (type: string) => ({
  metas: [{ uuid: `${type}-1`, label: '1', type }],
  nextCursor: `${type}-1`,
  hasMoreAfter: false,
  hasMoreBefore: false,
});

beforeEach(() => {
  api.createBuildGraphQLClient.mockClear();
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
});

type Layout = ReactElement<Record<string, unknown>>;

/** Every element in a tree, outermost first. */
const elementsIn = (node: ReactNode): Layout[] => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elementsIn);
  const element = node as Layout;
  return [element, ...elementsIn(element.props?.children as ReactNode)];
};

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

describe('StackReaderLayout (AC1)', () => {
  it('is exported from the ssr entry as a function', () => {
    expect(typeof StackReaderLayout).toBe('function');
  });

  it('for a uuid slug, wraps ReaderLayout in one StackReaderProvider for the work', async () => {
    const element = await layout(WORK);

    expect(element.type).toBe(StackReaderProvider);
    expect(element.props.workUuid).toBe(WORK);
    expect(
      elementsIn(element).filter(({ type }) => type === StackReaderProvider),
    ).toHaveLength(1);
    expect(
      elementsIn(element).filter(({ type }) => type === ReaderLayout),
    ).toHaveLength(1);
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

  it('reads the stack seed once, with the build client and the slug as the work', async () => {
    const element = await layout(WORK);

    // One section read per section, and only one pass over them.
    expect(api.getPassageMetaPage).toHaveBeenCalledTimes(STACK_SECTIONS.length);
    for (const call of api.getPassageMetaPage.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
      );
    }
    for (const call of api.getTranslationBlocks.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({ client: BUILD_CLIENT, uuid: WORK }),
      );
    }
    // The provider is handed what was read.
    const seed = element.props.seed as {
      workUuid: string;
      sections: { tab: string }[];
    };
    expect(seed.workUuid).toBe(WORK);
    expect(seed.sections.map(({ tab }) => tab)).toEqual(
      STACK_SECTIONS.map(({ tab }) => tab),
    );
  });

  it('for a slug that is not a uuid, reads nothing and renders ReaderLayout directly', async () => {
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
    expect(api.getPassageMetaPage).not.toHaveBeenCalled();
    expect(api.getTranslationBlocks).not.toHaveBeenCalled();
  });
});
