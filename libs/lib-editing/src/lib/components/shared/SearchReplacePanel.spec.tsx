import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { replace } from '@eightyfourthousand/client-graphql';
import type { SearchActionContext } from '@eightyfourthousand/lib-search';

import { SearchReplacePanel } from './SearchReplacePanel';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  replace: jest.fn(),
}));

const replaceMock = replace as jest.MockedFunction<typeof replace>;

type Occurrence = { type: 'alignment' | 'passage'; passageUuid: string };

/**
 * A search for "dharma". Each occurrence is a match in that passage's content;
 * `tibetanOnly` adds alignment matches whose English doesn't contain the term.
 */
const context = (
  occurrences: Occurrence[],
  { tibetanOnly = [] as string[] } = {},
): SearchActionContext =>
  ({
    searchQuery: 'dharma',
    useRegex: false,
    passageOccurrences: occurrences.map((o) => ({ ...o, start: 0, end: 6 })),
    passages: occurrences
      .filter((o) => o.type === 'passage')
      .map((o) => ({ uuid: o.passageUuid, content: 'dharma' })),
    alignments: [
      ...occurrences
        .filter((o) => o.type === 'alignment')
        .map((o) => ({ uuid: o.passageUuid, content: 'dharma' })),
      ...tibetanOnly.map((uuid) => ({
        uuid,
        content: 'the teaching',
        source: 'ཆོས',
      })),
    ],
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
  beforeEach(() => {
    replaceMock.mockReset();
    replaceMock.mockResolvedValue({ success: true, passages: [] } as never);
  });

  // DEV-849: translation passages come back from search as alignment matches.
  // Their occurrences are in the English, so they are replaceable.
  it('replaces matches in translation passages', async () => {
    await open(
      context([
        { type: 'alignment', passageUuid: 'p1' },
        { type: 'alignment', passageUuid: 'p1' },
        { type: 'alignment', passageUuid: 'p2' },
      ]),
    );

    expect(button('Replace').disabled).toBe(false);
    expect(button('Replace all').disabled).toBe(false);
    expect(screen.queryByText(/in the Tibetan source/)).toBeNull();

    await userEvent.click(button('Replace all'));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetUuids: ['p1', 'p2'] }),
    );
  });

  it('replaces the active match in a translation passage', async () => {
    await open(context([{ type: 'alignment', passageUuid: 'p1' }]));

    await userEvent.click(button('Replace'));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUuids: ['p1'],
        cursorPassageUuid: 'p1',
      }),
    );
  });

  it('targets translation and other passages together', async () => {
    await open(
      context([
        { type: 'alignment', passageUuid: 'p1' },
        { type: 'passage', passageUuid: 'p2' },
      ]),
    );

    await userEvent.click(button('Replace all'));
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetUuids: ['p1', 'p2'] }),
    );
  });

  // A match in the Tibetan alone has no occurrence in the English.
  it('explains why nothing can be replaced when every match is in the Tibetan', async () => {
    await open(context([], { tibetanOnly: ['p1', 'p2'] }));

    expect(button('Replace all').disabled).toBe(true);
    expect(button('Replace').disabled).toBe(true);
    expect(screen.queryByText(/in the Tibetan source/)).not.toBeNull();
  });

  it('does not blame the Tibetan when some matches are in the English', async () => {
    await open(
      context([{ type: 'alignment', passageUuid: 'p1' }], {
        tibetanOnly: ['p2'],
      }),
    );

    expect(button('Replace all').disabled).toBe(false);
    expect(screen.queryByText(/in the Tibetan source/)).toBeNull();
  });
});
