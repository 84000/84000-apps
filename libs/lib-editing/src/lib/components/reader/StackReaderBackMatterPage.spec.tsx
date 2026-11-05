import type { ReactElement } from 'react';

import { StackReaderBackMatterPage } from './StackReaderBackMatterPage';

jest.mock('@eightyfourthousand/client-graphql/ssr', () => ({
  createBuildGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getWorkGlossaryTerms: jest.fn(async () => ({
    terms: [{ uuid: 'g1' }],
    hasMoreAfter: false,
  })),
  getWorkBibliography: jest.fn(async () => [{ heading: 'b', entries: [] }]),
}));
jest.mock('@eightyfourthousand/lib-instr/static', () => ({
  isStaticFeatureEnabled: jest.fn(() => false),
}));
jest.mock('./StackReaderBackMatterPanel', () => ({
  StackReaderBackMatterPanel: () => null,
}));
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => 'not-found'),
}));

const api = jest.requireMock('@eightyfourthousand/client-graphql/ssr') as {
  getPassageMetaPage: jest.Mock;
  getWorkGlossaryTerms: jest.Mock;
  getWorkBibliography: jest.Mock;
};

const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

type PanelProps = {
  workUuid: string;
  hasEndnotes: boolean;
  hasAbbreviations: boolean;
  glossary: unknown;
  bibliography: unknown;
  withAttestations: boolean;
};

const page = async (slug: string) =>
  (await StackReaderBackMatterPage({
    params: Promise.resolve({ slug }),
  })) as ReactElement<PanelProps>;

beforeEach(() => {
  api.getPassageMetaPage
    .mockReset()
    .mockImplementation(async ({ type }) => ({
      metas: type === 'endnotes' ? [{ uuid: 'n1' }] : [],
    }));
  api.getWorkGlossaryTerms.mockClear();
  api.getWorkBibliography.mockClear();
});

describe('StackReaderBackMatterPage', () => {
  it('shows the stacked tabs a work has, without reading their content', async () => {
    const { props } = await page(WORK);

    expect(api.getPassageMetaPage.mock.calls.map(([args]) => args)).toEqual([
      expect.objectContaining({ uuid: WORK, type: 'endnotes', limit: 1 }),
      expect.objectContaining({ uuid: WORK, type: 'abbreviations', limit: 1 }),
    ]);
    expect(props.workUuid).toBe(WORK);
    expect(props.hasEndnotes).toBe(true);
    expect(props.hasAbbreviations).toBe(false);
  });

  it('reads the glossary and bibliography as the paginated panel does', async () => {
    const { props } = await page(WORK);

    expect(api.getWorkGlossaryTerms).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: WORK, withAttestations: false }),
    );
    expect(api.getWorkBibliography).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: WORK }),
    );
    expect(props.glossary).toEqual({
      terms: [{ uuid: 'g1' }],
      hasMoreAfter: false,
    });
    expect(props.bibliography).toEqual([{ heading: 'b', entries: [] }]);
  });

  it('reads nothing for a slug that is not a uuid', async () => {
    expect(
      await StackReaderBackMatterPage({
        params: Promise.resolve({ slug: 'toh1' }),
      }),
    ).toBe('not-found');
    expect(api.getPassageMetaPage).not.toHaveBeenCalled();
  });
});
