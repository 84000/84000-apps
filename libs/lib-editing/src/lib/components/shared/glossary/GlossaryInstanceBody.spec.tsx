import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';

import { GlossaryInstanceBody } from './GlossaryInstanceBody';

const mockUpdatePanel = jest.fn();

jest.mock('../NavigationProvider', () => ({
  useNavigation: () => ({ updatePanel: mockUpdatePanel, toh: undefined }),
}));
jest.mock('../hooks/useGlossaryInstanceListener', () => ({
  useGlossaryInstanceListener: jest.fn(),
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getTermPassages: jest.fn(),
}));
jest.mock('@eightyfourthousand/lib-instr', () => ({
  GatedFeature: () => null,
}));

/** An instance attested in one passage of the given type. */
const instanceIn = (type: string) =>
  ({
    uuid: 'g-1',
    authority: 'a-1',
    names: { english: 'term' },
    passages: {
      items: [{ uuid: 'p-1', type, label: 'attested' }],
      nextCursor: null,
      hasMore: false,
    },
  }) as unknown as GlossaryTermInstance;

beforeEach(() => mockUpdatePanel.mockClear());

describe('GlossaryInstanceBody passage links', () => {
  // A section's heading row is typed `<section>Header`, and it lives in the
  // same tab as the section body, not in the translation fallback.
  it.each([
    ['summaryHeader', 'main', 'front'],
    ['abbreviationsHeader', 'right', 'abbreviations'],
    ['translation', 'main', 'translation'],
  ])('opens a %s passage in %s/%s', async (type, panel, tab) => {
    render(<GlossaryInstanceBody instance={instanceIn(type)} />);

    await userEvent.click(screen.getByText('attested'));

    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: panel,
      state: { open: true, tab, hash: 'p-1' },
    });
  });
});
