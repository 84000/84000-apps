import { render, screen } from '@testing-library/react';
import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';

import { GlossaryPassagesProvider } from './GlossaryPassagesDialog';
import { GlossaryTermList } from './GlossaryTermList';

const mockGetGlossaryTermExcerpts = jest.fn();

jest.mock('../hooks/useGlossaryInstanceListener', () => ({
  useGlossaryInstanceListener: jest.fn(),
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getGlossaryTermExcerpts: (...args: unknown[]) =>
    mockGetGlossaryTermExcerpts(...args),
}));
jest.mock('../NavigationContext', () => ({
  useNavigation: () => ({ toh: 'toh8', updatePanel: jest.fn() }),
}));
// The labelled row pulls in search, which needs a server runtime.
jest.mock('../LabeledElement', () => ({
  LabeledElement: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@eightyfourthousand/lib-instr', () => ({
  GatedFeature: () => null,
}));

const mockTerms = ['virtue', 'merit'].map(
  (english, i) =>
    ({
      uuid: `g-${i + 1}`,
      authority: `a-${i + 1}`,
      termNumber: i + 1,
      names: { english },
      definition: '<p>A word.</p>',
    }) as unknown as GlossaryTermInstance,
);

jest.mock('./GlossaryPaginationProvider', () => ({
  useGlossaryPagination: () => ({
    terms: mockTerms,
    startCursor: null,
    endIsLoading: false,
  }),
}));

describe('GlossaryTermList', () => {
  it('gives every entry a passages link without reading passages', () => {
    render(
      <GlossaryPassagesProvider>
        <GlossaryTermList />
      </GlossaryPassagesProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Passages ›' })).toHaveLength(
      mockTerms.length,
    );
    expect(mockGetGlossaryTermExcerpts).not.toHaveBeenCalled();
  });
});
