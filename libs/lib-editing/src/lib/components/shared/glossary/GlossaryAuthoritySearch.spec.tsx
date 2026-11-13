import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GlossaryAuthorityMatch } from '@eightyfourthousand/data-access';

import {
  GlossaryAuthoritySearch,
  definitionStart,
  shownAuthorityNames,
} from './GlossaryAuthoritySearch';

const mockSearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  searchGlossaryAuthorities: (args: unknown) => mockSearch(args),
}));

const name = (
  uuid: string,
  language: string,
  content: string,
  contentTransformed: string | null = null,
) => ({ uuid, language, content, contentTransformed });

const MANJUSRI: GlossaryAuthorityMatch = {
  uuid: 'a1',
  headword: 'Mañjuśrī',
  headwordLanguage: 'Sa-Ltn',
  definition: '<p>The bodhisattva of <em>wisdom</em>.</p>',
  names: [
    name('n1', 'Bo-Ltn', '’jam dpal', 'འཇམ་དཔལ།'),
    name('n2', 'Bo-Ltn', '’jam dbyangs', 'འཇམ་དབྱངས།'),
    name('n3', 'Sa-Ltn', 'Mañjuśrī'),
    name('n4', 'en', 'Gentle Glory'),
  ],
  matchedName: null,
};

const OTHER: GlossaryAuthorityMatch = {
  ...MANJUSRI,
  uuid: 'a2',
  headword: 'Mañjughoṣa',
  definition: null,
  names: [],
};

/** Type, then let the input's debounce pass and the search answer. */
const typeQuery = async (text: string) => {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
};

describe('GlossaryAuthoritySearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSearch.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('searches what is typed and lists each match', async () => {
    mockSearch.mockResolvedValue([MANJUSRI]);
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} />);

    await typeQuery('jam dpal');

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'jam dpal' }),
    );
    const result = screen.getByRole('button', { name: /Mañjuśrī/ });
    expect(result.textContent).toContain('Sanskrit');
    expect(result.textContent).toContain('འཇམ་དཔལ།');
    expect(result.textContent).toContain('Gentle Glory');
    expect(result.textContent).toContain('The bodhisattva of wisdom.');
  });

  it('hands the picked authority to onSelect', async () => {
    mockSearch.mockResolvedValue([MANJUSRI, OTHER]);
    const onSelect = jest.fn();
    render(<GlossaryAuthoritySearch onSelect={onSelect} />);

    await typeQuery('manju');
    fireEvent.click(screen.getByRole('button', { name: /Mañjughoṣa/ }));

    expect(onSelect).toHaveBeenCalledWith(OTHER);
  });

  it('marks the linked authority and does not offer it', async () => {
    mockSearch.mockResolvedValue([MANJUSRI, OTHER]);
    const onSelect = jest.fn();
    render(<GlossaryAuthoritySearch onSelect={onSelect} currentUuid="a1" />);

    await typeQuery('manju');
    const linked = screen.getByRole('button', { name: /Mañjuśrī/ });

    expect((linked as HTMLButtonElement).disabled).toBe(true);
    expect(linked.textContent).toContain('Linked now');
  });

  it('says when nothing matches, and when the search fails', async () => {
    mockSearch.mockResolvedValueOnce([]).mockResolvedValueOnce(null);
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} />);

    await typeQuery('zzz');
    expect(screen.getByText(/No authority matches/)).toBeTruthy();

    await typeQuery('zzzz');
    expect(screen.getByRole('alert').textContent).toContain(
      'could not be searched',
    );
  });

  it('searches the same query again after a failure', async () => {
    mockSearch.mockResolvedValueOnce(null).mockResolvedValueOnce([MANJUSRI]);
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} />);
    await typeQuery('manjusri');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    });
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Mañjuśrī')).toBeTruthy();
  });

  it('shows only the latest query’s results', async () => {
    let answerFirst: (value: GlossaryAuthorityMatch[]) => void = () => null;
    mockSearch
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce([OTHER]);
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} />);

    await typeQuery('manjus');
    await typeQuery('manjug');
    await act(async () => answerFirst([MANJUSRI]));

    expect(screen.getByRole('button', { name: /Mañjughoṣa/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mañjuśrī/ })).toBeNull();
  });

  it('does not search a blank query', async () => {
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} />);
    await typeQuery('   ');
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

describe('shownAuthorityNames', () => {
  it('puts the matched name first, then one name per language', () => {
    const shown = shownAuthorityNames(
      { ...MANJUSRI, matchedName: MANJUSRI.names[1] },
      3,
    );
    expect(shown.map((n) => n.uuid)).toEqual(['n2', 'n4', 'n1']);
  });

  it('leaves out a name that repeats the headword', () => {
    expect(shownAuthorityNames(MANJUSRI).map((n) => n.uuid)).not.toContain(
      'n3',
    );
  });
});

describe('definitionStart', () => {
  it('is the plain text, cut between words', () => {
    const start = definitionStart(`<p>${'word '.repeat(60)}</p>`, 23);
    expect(start).toBe('word word word word…');
  });

  it('is empty for no definition', () => {
    expect(definitionStart(null)).toBe('');
  });
});
