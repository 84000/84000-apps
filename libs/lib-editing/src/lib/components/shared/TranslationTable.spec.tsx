import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@eightyfourthousand/design-system';
import { Work } from '@eightyfourthousand/data-access';
import { TranslationsTable } from './TranslationTable';

let mockSearchParams: URLSearchParams;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/translations/reader',
  useSearchParams: () => mockSearchParams,
}));

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  window.history.replaceState(null, '', '/translations/reader');
  window.localStorage.clear();
});

const work = (overrides: Partial<Work>): Work => ({
  uuid: crypto.randomUUID(),
  title: 'Untitled',
  toh: ['toh1'],
  publicationDate: new Date('2024-01-15'),
  publicationVersion: '1.0.0',
  pages: 10,
  restriction: false,
  section: 'Discourses',
  ...overrides,
});

const WORKS: Work[] = [
  work({
    title: 'The Play in Full',
    toh: ['toh95'],
    tibetanTitle: 'རྒྱ་ཆེར་རོལ་པ།',
    wylieTitle: 'rgya cher rol pa',
    sanskritTitle: 'Lalitavistara',
  }),
  work({
    title: 'A Multitude of Buddhas',
    toh: ['toh12'],
  }),
  work({
    title: 'Ornament of the Light of Awareness',
    toh: ['toh1206'],
  }),
  work({
    title: 'Unfinished Draft',
    toh: ['toh44'],
    publicationDate: undefined,
  }),
];

const renderTable = () =>
  render(
    <TooltipProvider>
      <TranslationsTable works={WORKS} />
    </TooltipProvider>,
  );

// the search input is debounced; callers should waitFor the filtered result
const search = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText('Search translations...'), {
    target: { value },
  });
};

const bodyRowTitles = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td')?.textContent ?? '');

describe('TranslationsTable', () => {
  it('displays toh numbers in "Toh #" format', () => {
    renderTable();
    expect(screen.getAllByText('Toh 95').length).toBeGreaterThan(0);
  });

  it('displays Tibetan and Sanskrit titles under the main title', () => {
    renderTable();
    expect(
      screen.getAllByText('རྒྱ་ཆེར་རོལ་པ། · Lalitavistara').length,
    ).toBeGreaterThan(0);
  });

  it('sorts titles ignoring leading articles', () => {
    renderTable();
    expect(bodyRowTitles()).toEqual([
      expect.stringContaining('A Multitude of Buddhas'),
      expect.stringContaining('Ornament of the Light of Awareness'),
      expect.stringContaining('The Play in Full'),
      expect.stringContaining('Unfinished Draft'),
    ]);
  });

  it('finds works by "Toh #" search with exact matches first', async () => {
    renderTable();
    search('Toh 12');

    await waitFor(() => {
      const titles = bodyRowTitles();
      expect(titles).toHaveLength(2);
      expect(titles[0]).toContain('A Multitude of Buddhas');
      expect(titles[1]).toContain('Ornament of the Light of Awareness');
    });
  });

  it('finds works by raw toh format', async () => {
    renderTable();
    search('toh95');

    await waitFor(() => {
      expect(bodyRowTitles()).toEqual([
        expect.stringContaining('The Play in Full'),
      ]);
    });
  });

  it('finds works by Wylie title', async () => {
    renderTable();
    search('rgya cher rol pa');

    await waitFor(() => {
      expect(bodyRowTitles()).toEqual([
        expect.stringContaining('The Play in Full'),
      ]);
    });
  });

  it('finds works by Sanskrit title', async () => {
    renderTable();
    search('Lalitavistara');

    await waitFor(() => {
      expect(bodyRowTitles()).toEqual([
        expect.stringContaining('The Play in Full'),
      ]);
    });
  });

  it('hides unpublished works when the published-only switch is on', async () => {
    renderTable();
    expect(screen.getAllByText('Unpublished').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('switch', { name: 'Published only' }));

    await waitFor(() => {
      expect(screen.queryByText('Unpublished')).toBeNull();
    });
    expect(bodyRowTitles()).toHaveLength(3);

    fireEvent.click(screen.getByRole('switch', { name: 'Published only' }));
    await waitFor(() => {
      expect(bodyRowTitles()).toHaveLength(4);
    });
  });

  it('initializes search and filter state from the URL', () => {
    mockSearchParams = new URLSearchParams('q=toh95&published=1');
    renderTable();

    expect(bodyRowTitles()).toEqual([
      expect.stringContaining('The Play in Full'),
    ]);
  });

  it('writes search and filter state back to the URL and localStorage', async () => {
    renderTable();
    search('toh95');
    fireEvent.click(screen.getByRole('switch', { name: 'Published only' }));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('q')).toBe('toh95');
      expect(params.get('published')).toBe('1');
    });
    expect(
      window.localStorage.getItem('translations-table:/translations/reader'),
    ).toBe('q=toh95&published=1');
  });

  it('restores state from localStorage when the URL has none', () => {
    window.localStorage.setItem(
      'translations-table:/translations/reader',
      'q=toh95&published=1',
    );
    renderTable();

    expect(bodyRowTitles()).toEqual([
      expect.stringContaining('The Play in Full'),
    ]);
  });

  it('prefers URL state over localStorage', () => {
    window.localStorage.setItem(
      'translations-table:/translations/reader',
      'q=toh95',
    );
    mockSearchParams = new URLSearchParams('q=toh12');
    renderTable();

    expect(bodyRowTitles()).toEqual([
      expect.stringContaining('A Multitude of Buddhas'),
      expect.stringContaining('Ornament of the Light of Awareness'),
    ]);
  });

  it('clears the search when the clear button is clicked', async () => {
    renderTable();
    search('toh95');

    await waitFor(() => {
      expect(bodyRowTitles()).toHaveLength(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    await waitFor(() => {
      expect(bodyRowTitles()).toHaveLength(4);
    });
    const input = screen.getByPlaceholderText(
      'Search translations...',
    ) as HTMLInputElement;
    expect(input.value).toBe('');
    await waitFor(() => {
      expect(
        window.localStorage.getItem('translations-table:/translations/reader'),
      ).toBeNull();
    });
  });
});
