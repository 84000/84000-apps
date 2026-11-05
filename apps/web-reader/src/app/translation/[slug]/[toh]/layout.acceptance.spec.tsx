/**
 * @jest-environment node
 *
 * Acceptance tests for DEV-837 item 6a, section 5: the web-reader layout at
 * `translation/[slug]/[toh]/layout.tsx` (AC6.12).
 *
 * Written from the spec, not the implementation. The layout is called as a
 * function and the element it returns is inspected for the `initialToh` it
 * hands the reader layout, so nothing is rendered. Only the metadata read and
 * Next's `notFound` are faked, and the reader layouts are stubbed.
 */
import type { ReactElement, ReactNode } from 'react';
import Layout from './layout';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@eightyfourthousand/lib-editing', () => ({
  ReaderLayout: function ReaderLayout() {
    return null;
  },
}));
jest.mock('@eightyfourthousand/lib-editing/ssr', () => ({
  StackReaderLayout: function StackReaderLayout() {
    return null;
  },
}));

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  createBuildGraphQLClient: jest.fn(() => ({ name: 'build-client' })),
  getTranslationMetadataByUuid: jest.fn(),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getTranslationMetadataByUuid: jest.Mock;
};
const nav = jest.requireMock('next/navigation') as { notFound: jest.Mock };

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

type Element = ReactElement<Record<string, unknown>>;

/** Every element in a tree, outermost first. */
const elementsIn = (node: ReactNode): Element[] => {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elementsIn);
  const element = node as Element;
  return [element, ...elementsIn(element.props?.children as ReactNode)];
};

const publishedWork = (toh: string[]) => ({
  uuid: WORK,
  toh,
  publicationStatus: '1',
});

/** Runs the layout for a path and reports the `initialToh` it hands down. */
const initialTohFor = async (toh: string) => {
  const tree = await Layout({
    left: <div data-slot="left" />,
    main: <div data-slot="main" />,
    right: <div data-slot="right" />,
    params: Promise.resolve({ slug: WORK, toh }),
  } as never);
  const [reader] = elementsIn(tree as ReactNode).filter(
    (element) => element.props && 'initialToh' in element.props,
  );
  expect(reader).toBeDefined();
  return reader.props.initialToh;
};

beforeEach(() => {
  nav.notFound.mockClear();
  api.getTranslationMetadataByUuid.mockReset();
});

describe('web-reader [toh] layout (AC6.12)', () => {
  it("passes the path's toh when the work has it", async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue(
      publishedWork(['toh145', 'toh847']),
    );

    expect(await initialTohFor('toh847')).toBe('toh847');
  });

  it("passes the path's toh when it is the work's first", async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue(
      publishedWork(['toh145', 'toh847']),
    );

    expect(await initialTohFor('toh145')).toBe('toh145');
  });

  it("passes the work's first toh for the path segment 'default'", async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue(
      publishedWork(['toh145', 'toh847']),
    );

    expect(await initialTohFor('default')).toBe('toh145');
  });

  it("passes the work's first toh for a toh that belongs to another work", async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue(
      publishedWork(['toh145', 'toh847']),
    );

    expect(await initialTohFor('toh999')).toBe('toh145');
  });

  it('reads the work named by the slug', async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue(publishedWork(['toh1']));

    await initialTohFor('toh1');

    expect(api.getTranslationMetadataByUuid).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: WORK }),
    );
  });

  it('calls notFound for an unknown work', async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue(undefined);

    await expect(initialTohFor('toh1')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(nav.notFound).toHaveBeenCalled();
  });

  it('calls notFound for an unpublished work', async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue({
      ...publishedWork(['toh145']),
      publicationStatus: '2',
    });

    await expect(initialTohFor('toh145')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(nav.notFound).toHaveBeenCalled();
  });

  it('calls notFound for a work with no publication status', async () => {
    api.getTranslationMetadataByUuid.mockResolvedValue({
      uuid: WORK,
      toh: ['toh145'],
    });

    await expect(initialTohFor('toh145')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(nav.notFound).toHaveBeenCalled();
  });
});
