import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { GlossaryTermInstance } from '@eightyfourthousand/data-access';

import { GlossaryInstanceBody } from './GlossaryInstanceBody';

const mockGetGlossaryTermExcerpts = jest.fn();
let mockFlags: Record<string, boolean> = {};

jest.mock('../hooks/useGlossaryInstanceListener', () => ({
  useGlossaryInstanceListener: jest.fn(),
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getGlossaryTermExcerpts: (...args: unknown[]) =>
    mockGetGlossaryTermExcerpts(...args),
}));
jest.mock('@eightyfourthousand/lib-instr', () => ({
  GatedFeature: ({ flag, children }: { flag: string; children: ReactNode }) =>
    mockFlags[flag] ? <>{children}</> : null,
}));

const instance = {
  uuid: 'g-1',
  authority: 'a-1',
  names: { english: 'term', wylie: 'tshig' },
  definition: '<p>A word.</p>',
} as unknown as GlossaryTermInstance;

beforeEach(() => {
  mockFlags = {};
});

describe('GlossaryInstanceBody', () => {
  it('shows the entry without passage links or a passages read', () => {
    render(<GlossaryInstanceBody instance={instance} />);

    expect(screen.getByText('term')).toBeTruthy();
    expect(screen.getByText('tshig')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(mockGetGlossaryTermExcerpts).not.toHaveBeenCalled();
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
