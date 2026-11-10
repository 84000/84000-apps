import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';

import { GlossaryInstanceBody } from './GlossaryInstanceBody';

const mockUpdatePanel = jest.fn();
let mockFlags: Record<string, boolean> = {};

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
  GatedFeature: ({ flag, children }: { flag: string; children: ReactNode }) =>
    mockFlags[flag] ? <>{children}</> : null,
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

beforeEach(() => {
  mockUpdatePanel.mockClear();
  mockFlags = {};
});

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

describe('GlossaryInstanceBody authority link', () => {
  const ENTRY = 'a1a1a1a1-0000-4000-8000-000000000001';
  const AUTHORITY_A = 'b2b2b2b2-0000-4000-8000-00000000000a';
  const AUTHORITY_B = 'c3c3c3c3-0000-4000-8000-00000000000b';

  const entry = (authority: string) =>
    ({
      uuid: ENTRY,
      authority,
      workUuid: 'w-1',
      names: { english: 'term' },
    }) as unknown as GlossaryTermInstance;

  const linkHref = () =>
    screen
      .getByText(/View full entry/)
      .closest('a')
      ?.getAttribute('href');

  it("links to the entry's current authority, following it when the entry moves", () => {
    mockFlags = { 'authority-pages': true };
    const { rerender } = render(
      <GlossaryInstanceBody instance={entry(AUTHORITY_A)} />,
    );
    expect(linkHref()).toBe(`/glossary/${AUTHORITY_A}`);

    rerender(<GlossaryInstanceBody instance={entry(AUTHORITY_B)} />);

    expect(linkHref()).toBe(`/glossary/${AUTHORITY_B}`);
    expect(linkHref()).not.toContain(AUTHORITY_A);
    expect(linkHref()).not.toContain(ENTRY);
  });

  it('shows no authority link with authority-pages off', () => {
    mockFlags = { 'authority-pages': false };
    render(<GlossaryInstanceBody instance={entry(AUTHORITY_A)} />);

    expect(screen.queryByText(/View full entry/)).toBeNull();
  });
});
