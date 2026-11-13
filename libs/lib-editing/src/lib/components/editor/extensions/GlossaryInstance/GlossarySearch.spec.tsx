import { act, fireEvent, render, screen } from '@testing-library/react';

import { GlossarySearch } from './GlossarySearch';

// The stack's barrels reach `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSearchTerms = jest.fn();
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  searchWorkGlossaryTerms: (args: unknown) => mockSearchTerms(args),
}));

jest.mock('../../../shared', () => ({
  ...jest.requireActual('../../../shared'),
  useNavigation: () => ({ uuid: 'work-1' }),
}));

const NODES = [
  { uuid: 'g-1', termNumber: 4, names: { english: 'Indra' } },
  { uuid: 'g-2', termNumber: 9, names: { english: 'Indrabhūti' } },
];

/**
 * Type, then let the input and the search's debounces pass, in two steps: the
 * search's own timer is only set once the input's has fired and re-rendered.
 */
const search = async (text: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    jest.advanceTimersByTime(50);
  });
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
};

const createButton = () =>
  screen.queryByRole('button', { name: 'Create entry' });

beforeEach(() => {
  jest.useFakeTimers();
  mockSearchTerms.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('GlossarySearch create option', () => {
  it('offers “Create entry” below the results, which calls onCreate and links nothing', async () => {
    mockSearchTerms.mockResolvedValue(NODES);
    const onSelect = jest.fn();
    const onCreate = jest.fn();
    render(<GlossarySearch onSelect={onSelect} onCreate={onCreate} />);
    expect(createButton()).toBeTruthy();
    await search('Indra');

    const create = createButton() as HTMLElement;
    const last = screen.getByRole('button', { name: /g\.9/ });
    expect(
      last.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(create);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();

    mockSearchTerms.mockResolvedValue([]);
    await search('Nothing');
    expect(screen.getByText('No matching glossary terms found.')).toBeTruthy();
    expect(createButton()).toBeTruthy();
  });

  it('offers no “Create entry” without onCreate, with or without results', async () => {
    mockSearchTerms.mockResolvedValue(NODES);
    render(<GlossarySearch onSelect={jest.fn()} />);
    expect(createButton()).toBeNull();

    await search('Indra');
    expect(createButton()).toBeNull();

    mockSearchTerms.mockResolvedValue([]);
    await search('Nothing');
    expect(createButton()).toBeNull();
  });
});
