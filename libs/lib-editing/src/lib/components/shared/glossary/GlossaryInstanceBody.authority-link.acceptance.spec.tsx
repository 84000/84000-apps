/**
 * Acceptance tests for DEV-907, the popover's authority link, written from
 * TASK.md alone.
 *
 *  AC6  With `authority-pages` on, the popover's "View full entry" link uses
 *       the authority of the linked entry. After the entry moves to another
 *       authority, the link points to the new one.
 *
 * The popover body takes the entry (`GlossaryTermInstance`), never the
 * annotation, so the entry's authority is the only one it can use. These tests
 * pin that: the link follows the entry, including when the entry changes.
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  glossaryTermInstanceFromDTO,
  type GlossaryTermInstance,
  type GlossaryTermInstanceDTO,
} from '@eightyfourthousand/data-access';

import { GlossaryInstanceBody } from './GlossaryInstanceBody';

let mockFlags: Record<string, boolean> = {};

jest.mock('../NavigationProvider', () => ({
  useNavigation: () => ({ updatePanel: jest.fn(), toh: undefined }),
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

beforeEach(() => {
  mockFlags = { 'authority-pages': true };
});

describe('GlossaryInstanceBody authority link (DEV-907)', () => {
  it('[AC6] with authority-pages on, links to the authority of the entry', () => {
    render(<GlossaryInstanceBody instance={entry(AUTHORITY_A)} />);

    expect(linkHref()).toBe(`/glossary/${AUTHORITY_A}`);
  });

  it('[AC6] after the entry moves to another authority, the link points to the new one', () => {
    const { rerender } = render(
      <GlossaryInstanceBody instance={entry(AUTHORITY_A)} />,
    );
    expect(linkHref()).toBe(`/glossary/${AUTHORITY_A}`);

    rerender(<GlossaryInstanceBody instance={entry(AUTHORITY_B)} />);

    expect(linkHref()).toBe(`/glossary/${AUTHORITY_B}`);
    expect(linkHref()).not.toContain(AUTHORITY_A);
  });

  it('[AC6] the link is the entry authority, not the entry uuid', () => {
    render(<GlossaryInstanceBody instance={entry(AUTHORITY_A)} />);

    expect(linkHref()).not.toContain(ENTRY);
  });

  it('[AC6] with authority-pages off, there is no authority link', () => {
    mockFlags = { 'authority-pages': false };
    render(<GlossaryInstanceBody instance={entry(AUTHORITY_A)} />);

    expect(screen.queryByText(/View full entry/)).toBeNull();
  });

  it("[AC6] the entry read from its stored row carries the row's current authority", () => {
    // The popover's entry comes from the glossary entry row (authority_uuid),
    // so an entry relinked to another authority reads back with the new one.
    const row = (authority_uuid: string): GlossaryTermInstanceDTO =>
      ({
        uuid: ENTRY,
        authority_uuid,
        work_uuid: 'w-1',
        names: { english: 'term' },
      }) as GlossaryTermInstanceDTO;

    expect(glossaryTermInstanceFromDTO(row(AUTHORITY_A)).authority).toBe(
      AUTHORITY_A,
    );
    expect(glossaryTermInstanceFromDTO(row(AUTHORITY_B)).authority).toBe(
      AUTHORITY_B,
    );
  });
});
