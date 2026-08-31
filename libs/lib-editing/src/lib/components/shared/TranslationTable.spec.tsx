import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@eightyfourthousand/design-system';
import {
  SemVer,
  TohokuCatalogEntry,
  Work,
} from '@eightyfourthousand/data-access';
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

// The template literal type describes the plain form; the catalogue's suffixed
// entries ("toh1-2", "toh1059a") are read out of the database with this cast.
const toh = (entry: string) => entry as TohokuCatalogEntry;

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

const renderTable = (works: Work[] = WORKS) =>
  render(
    <TooltipProvider>
      <TranslationsTable works={works} />
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

  it('sorts by toh number, with sub-numbers breaking ties only', () => {
    mockSearchParams = new URLSearchParams('sort=toh.asc');
    renderTable([
      work({ title: 'Toh 12 work', toh: ['toh12'] }),
      work({ title: 'Toh 1-10 work', toh: [toh('toh1-10')] }),
      work({ title: 'Toh 1 work', toh: ['toh1'] }),
      work({ title: 'Toh 1-2 work', toh: [toh('toh1-2')] }),
      work({ title: 'Toh 2 work', toh: ['toh2'] }),
    ]);

    expect(bodyRowTitles()).toEqual([
      expect.stringContaining('Toh 1 work'),
      expect.stringContaining('Toh 1-2 work'),
      expect.stringContaining('Toh 1-10 work'),
      expect.stringContaining('Toh 2 work'),
      expect.stringContaining('Toh 12 work'),
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

  // The column prefers the version being served, from work_versions, over the legacy
  // works.publicationVersion the publish pipeline never writes — but falls back to it
  // while works are still being brought onto the pipeline, since a work with no snapshot
  // yet has only that number and users know the text by it.
  it('prefers the live version, falls back to the legacy one, then a dash', async () => {
    render(
      <TooltipProvider>
        <TranslationsTable
          works={[
            work({
              title: 'Live version wins',
              publishedVersion: '2.1.0',
              publicationVersion: '1.4.0',
            }),
            work({
              title: 'No snapshot yet',
              publishedVersion: undefined,
              publicationVersion: '1.4.1',
            }),
            work({
              title: 'Neither',
              publishedVersion: undefined,
              publicationVersion: undefined as unknown as SemVer,
            }),
          ]}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('2.1.0')).toBeTruthy();
    // The live version wins over a legacy value that is present and different, which is
    // what proves the preference rather than a coincidence.
    expect(screen.queryByText('1.4.0')).toBeNull();
    expect(screen.getByText('1.4.1')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
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

  it('restores column widths from localStorage', () => {
    window.localStorage.setItem(
      'translations-table:/translations/reader',
      'widths=title:40,toh:28',
    );
    renderTable();

    const headers = screen.getAllByRole('columnheader');
    // 40 + 28 + pages 7 + date 10 + version 7 + restriction 4 = 96 shares
    expect((headers[0] as HTMLElement).style.width).toBe(
      `${(40 / 96) * 100}%`,
    );
    expect((headers[1] as HTMLElement).style.width).toBe(
      `${(28 / 96) * 100}%`,
    );
  });

  it('ignores unknown columns in stored widths', () => {
    window.localStorage.setItem(
      'translations-table:/translations/reader',
      'widths=bogus:40,title:junk',
    );
    renderTable();

    const headers = screen.getAllByRole('columnheader');
    // defaults: title 58 of 96 total shares
    expect((headers[0] as HTMLElement).style.width).toBe(
      `${(58 / 96) * 100}%`,
    );
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
