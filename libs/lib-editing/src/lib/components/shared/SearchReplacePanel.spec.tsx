import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchActionContext } from '@eightyfourthousand/lib-search';

import { SearchReplacePanel } from './SearchReplacePanel';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  replace: jest.fn(),
}));

const context = (
  occurrences: { type: 'alignment' | 'passage'; passageUuid: string }[],
): SearchActionContext =>
  ({
    searchQuery: 'dharma',
    useRegex: false,
    passageOccurrences: occurrences.map((o) => ({ ...o, start: 0, end: 6 })),
    passages: occurrences
      .filter((o) => o.type === 'passage')
      .map((o) => ({ uuid: o.passageUuid })),
    activeOccurrence: occurrences[0] && { ...occurrences[0], start: 0, end: 6 },
    activeOccurrenceIndex: 0,
    activePassageUuid: occurrences[0]?.passageUuid,
    setShouldScrollActiveOccurrence: jest.fn(),
    scrollActiveOccurrenceIntoView: jest.fn(),
    moveActiveOccurrence: jest.fn(),
    refreshSearch: jest.fn(),
  }) as unknown as SearchActionContext;

/** The action button, not the section's own "Replace" trigger. */
const button = (name: string) =>
  screen
    .getAllByRole('button', { name })
    .find((el) => !el.hasAttribute('aria-expanded')) as HTMLButtonElement;

const open = async (searchContext: SearchActionContext) => {
  render(<SearchReplacePanel canReplace searchContext={searchContext} />);
  await userEvent.click(screen.getByRole('button', { expanded: false }));
};

describe('SearchReplacePanel', () => {
  // Alignment matches are Tibetan source text, which replace doesn't touch.
  it('explains why nothing can be replaced when every match is an alignment', async () => {
    await open(context([{ type: 'alignment', passageUuid: 'p1' }]));

    expect(button('Replace all').disabled).toBe(true);
    expect(button('Replace').disabled).toBe(true);
    expect(screen.queryByText(/in the Tibetan source/)).not.toBeNull();
  });

  it('replaces all but not the active match when that one is an alignment', async () => {
    await open(
      context([
        { type: 'alignment', passageUuid: 'p1' },
        { type: 'passage', passageUuid: 'p2' },
      ]),
    );

    expect(button('Replace all').disabled).toBe(false);
    expect(button('Replace').disabled).toBe(true);
    expect(screen.queryByText(/in the Tibetan source/)).toBeNull();
  });
});
