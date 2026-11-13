/**
 * Acceptance tests for DEV-884 criteria 15 and 17: searching authorities by
 * headword or any name, listing matches, and never creating one.
 */
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSearch = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  searchGlossaryAuthorities: (args: unknown) => mockSearch(args),
}));

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  GlossaryAuthorityMatch,
  GlossaryAuthorityName,
} from '@eightyfourthousand/data-access';

import { GlossaryAuthoritySearch } from './GlossaryAuthoritySearch';

const name = (
  uuid: string,
  language: string,
  content: string,
  contentTransformed: string | null = null,
): GlossaryAuthorityName => ({ uuid, language, content, contentTransformed });

const LONG_DEFINITION = `<p>Opening words of the standard definition. ${'More and more words follow here. '.repeat(
  40,
)}TAILMARKER</p>`;

const bodhicitta = (
  o: Partial<GlossaryAuthorityMatch> = {},
): GlossaryAuthorityMatch => ({
  uuid: 'auth-b',
  headword: 'Bodhicitta',
  headwordLanguage: 'Sa-Ltn',
  definition: LONG_DEFINITION,
  names: [
    name('1', 'en', 'awakening mind'),
    name('2', 'Bo-Ltn', 'byang chub kyi sems', 'བྱང་ཆུབ་ཀྱི་སེམས'),
    name('3', 'Sa-Ltn', 'bodhicitta'),
    name('4', 'zh', '菩提心'),
    name('5', 'en', 'mind of awakening'),
    name('6', 'en', 'enlightened attitude'),
    name('7', 'en', 'spirit of enlightenment'),
    name('8', 'en', 'thought of enlightenment'),
    name('9', 'en', 'bodhi thought'),
    name('10', 'en', 'awakened heart'),
  ],
  matchedName: null,
  ...o,
});

const prajna = (): GlossaryAuthorityMatch => ({
  uuid: 'auth-p',
  headword: 'Prajna',
  headwordLanguage: 'Sa-Ltn',
  definition: '<p>Discriminating wisdom.</p>',
  names: [name('p1', 'en', 'wisdom')],
  matchedName: null,
});

const search = async (
  results: GlossaryAuthorityMatch[] | null,
  query = 'bodhi',
  props: Partial<React.ComponentProps<typeof GlossaryAuthoritySearch>> = {},
) => {
  mockSearch.mockResolvedValue(results);
  const onSelect = jest.fn();
  const user = userEvent.setup();
  render(<GlossaryAuthoritySearch onSelect={onSelect} {...props} />);
  await user.type(screen.getByRole('searchbox'), query);
  return { onSelect, user };
};

const results = () =>
  screen.findByRole(
    'list',
    { name: /matching authorities/i },
    { timeout: 4000 },
  );

beforeEach(() => mockSearch.mockReset());

describe('[AC15] authority search', () => {
  it('[AC15] lists a match with its headword', async () => {
    await search([bodhicitta(), prajna()]);
    const list = await results();
    expect(list.textContent).toContain('Bodhicitta');
    expect(list.textContent).toContain('Prajna');
  });

  it('[AC15] shows a few of its names, not all of them', async () => {
    await search([bodhicitta()]);
    const text = (await results()).textContent ?? '';
    const shown = bodhicitta().names.filter((n) => text.includes(n.content));
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(shown.length).toBeLessThan(bodhicitta().names.length);
  });

  it('[AC15] shows a Tibetan name in script and Wylie', async () => {
    await search([bodhicitta()]);
    const text = (await results()).textContent ?? '';
    expect(text).toContain('byang chub kyi sems');
    expect(text).toContain('བྱང་ཆུབ་ཀྱི་སེམས');
  });

  it('[AC15] shows the name that matched, wherever it falls in the list', async () => {
    const matched = name('last', 'Bo-Ltn', 'matched wylie', 'གཞན་མིང་');
    await search([
      bodhicitta({
        names: [...bodhicitta().names, matched],
        matchedName: matched,
      }),
    ]);
    const text = (await results()).textContent ?? '';
    expect(text).toContain('matched wylie');
  });

  it('[AC15] shows only the start of the standard definition', async () => {
    await search([bodhicitta()]);
    const text = (await results()).textContent ?? '';
    expect(text).toContain('Opening words of the standard definition.');
    expect(text).not.toContain('TAILMARKER');
    expect(text).not.toContain('<p>');
  });

  it('[AC15] copes with an authority with no standard definition and no names', async () => {
    await search([{ ...prajna(), definition: null, names: [] }]);
    expect((await results()).textContent).toContain('Prajna');
  });

  it.each([
    ['a headword', 'manjusri'],
    ['an English name', 'awakening mi'],
    ['a Wylie name', 'byang chub kyi se'],
    ['Tibetan script', 'བྱང་ཆུབ་ཀྱི་སེམས།'],
    ['a Sanskrit name with diacritics', 'bodhicitta'],
    ['a Chinese name', '菩提心'],
  ])('[AC15] searches %s as typed', async (_what, query) => {
    await search([bodhicitta()], query);
    await results();
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ query }),
      ),
    );
  });

  it('[AC15] does not search for an empty query', async () => {
    mockSearch.mockResolvedValue([bodhicitta()]);
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} />);
    await new Promise((r) => setTimeout(r, 1200));
    expect(mockSearch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('list', { name: /matching authorities/i }),
    ).toBeNull();
  });

  it('[AC15] says so when nothing matches', async () => {
    await search([], 'zzzz');
    await waitFor(
      () =>
        expect(
          screen
            .getByRole('searchbox')
            .closest('[data-glossary-authority-search]')?.textContent ?? '',
        ).toMatch(/no |nothing|not found|0 /i),
      { timeout: 4000 },
    );
    expect(
      screen.queryByRole('list', { name: /matching authorities/i })?.children
        .length ?? 0,
    ).toBe(0);
  });

  it('[AC15] says so when the search fails', async () => {
    await search(null, 'bodhi');
    await waitFor(
      () =>
        expect(
          screen
            .getByRole('searchbox')
            .closest('[data-glossary-authority-search]')?.textContent ?? '',
        ).toMatch(/fail|error|couldn|could not|try again|unable/i),
      { timeout: 4000 },
    );
  });
});

describe('[AC15][AC16] picking a result', () => {
  it('[AC16] hands back the authority that was picked, whole', async () => {
    const { onSelect, user } = await search([bodhicitta(), prajna()]);
    const list = await results();
    await user.click(
      within(list).getByText('Prajna').closest('button') as HTMLElement,
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      uuid: 'auth-p',
      headword: 'Prajna',
    });
  });

  it('[AC16] does not offer the authority the entry is already linked to', async () => {
    const { onSelect, user } = await search([bodhicitta(), prajna()], 'bodhi', {
      currentUuid: 'auth-b',
    });
    const list = await results();
    // Shown as linked is fine; picking it is not.
    const current = within(list).queryByText('Bodhicitta')?.closest('button');
    if (current) {
      expect((current as HTMLButtonElement).disabled).toBe(true);
      await user.click(current);
    }
    expect(onSelect).not.toHaveBeenCalled();
    expect(within(list).getByText('Prajna')).toBeTruthy();
  });

  it('[AC16] picks nothing until a result is chosen', async () => {
    const { onSelect } = await search([bodhicitta()]);
    await results();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('[AC17] never creates an authority', () => {
  it('[AC17] offers no create control with results or without', async () => {
    await search([bodhicitta()]);
    await results();
    const withResults = screen
      .getAllByRole('button')
      .map((b) => `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`);
    expect(
      withResults.filter((l) => /create|new authority|add authority/i.test(l)),
    ).toEqual([]);
  });

  it('[AC17] offers no create control when nothing matches', async () => {
    await search([], 'zzzz');
    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 300));
    const labels = screen
      .queryAllByRole('button')
      .map((b) => `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`);
    expect(
      labels.filter((l) => /create|new authority|add authority/i.test(l)),
    ).toEqual([]);
  });
});

describe('disabled', () => {
  it('[AC2] cannot be searched when disabled', () => {
    render(<GlossaryAuthoritySearch onSelect={jest.fn()} disabled />);
    expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
