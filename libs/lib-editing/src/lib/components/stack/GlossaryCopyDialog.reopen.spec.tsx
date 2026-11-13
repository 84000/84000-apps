import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import type {
  GlossaryCopySource,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import { GlossaryCopyDialog } from './GlossaryCopyDialog';
import type { StackController } from './StackController';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSearch = jest.fn();
const mockOfAuthority = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  searchGlossaryEntriesToCopy: (args: unknown) => mockSearch(args),
  getGlossaryEntriesOfAuthority: (args: unknown) => mockOfAuthority(args),
}));

const HERE = 'w-here';

const entry = (
  uuid: string,
  workUuid: string,
  english: string,
  definition = `<p>${english} is defined at some length here.</p>`,
): GlossaryEntry => ({
  uuid,
  workUuid,
  authorityUuid: 'a1',
  definition,
  definitionRend: null,
  glossMode: 'match',
  names: [
    {
      glossaryUuid: uuid,
      nameUuid: `n-${uuid}`,
      nameAuthorityUuid: 'a1',
      language: 'en',
      content: english,
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
    {
      glossaryUuid: `r-${uuid}`,
      nameUuid: `nb-${uuid}`,
      nameAuthorityUuid: 'a1',
      language: 'Bo-Ltn',
      content: 'pad+ma',
      contentTransformed: 'པདྨ',
      termType: null,
      attestation: null,
    },
  ],
});

const SOURCE: GlossaryCopySource = {
  entry: entry('s1', 'w-there', 'Lotus', `<p>${'A flower. '.repeat(40)}</p>`),
  label: 'g.12',
  work: { uuid: 'w-there', toh: 'toh8', title: 'The Hundred Thousand' },
  headword: 'padma',
  headwordLanguage: 'Sa-Ltn',
};

const controllerWith = (copy = jest.fn()) =>
  ({
    getGlossary: () => ({ work: { workUuid: HERE } }),
    getMeta: (uuid: string) =>
      uuid === 'mine' ? { uuid, label: 'g.4', type: 'glossary' } : null,
    getGlossaryEntry: () => null,
    copyGlossaryEntry: copy,
  }) as unknown as StackController;

const typeQuery = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Search other works'), {
    target: { value: text },
  });
  // Past the pause the search waits for, until it has answered.
  await waitFor(() => expect(screen.queryByText('Searching…')).toBeNull());
  await waitFor(() => expect(mockSearch).toHaveBeenCalled());
  await act(async () => undefined);
};

const choose = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Lotus/ }));
  });
};

beforeEach(() => {
  mockSearch.mockReset().mockResolvedValue([SOURCE]);
  mockOfAuthority.mockReset().mockResolvedValue([]);
});

/** Holds whether the dialog is open, as the row menu does. */
const Host = ({ controller }: { controller: StackController }) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <GlossaryCopyDialog
        controller={controller}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
};

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
  await act(async () => undefined);
};

const expectFresh = () => {
  const box = screen.getByLabelText('Search other works') as HTMLInputElement;
  expect(box.value).toBe('');
  expect(screen.queryByText('Searching…')).toBeNull();
};

describe('GlossaryCopyDialog opened again', () => {
  it('starts empty after Cancel', async () => {
    render(<Host controller={controllerWith()} />);
    await typeQuery('lotus');
    await click('Cancel');
    await click('Reopen');
    expectFresh();

    mockSearch.mockClear();
    await typeQuery('padma');
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'padma' }),
    );
  });

  it('starts empty after a copy', async () => {
    const copy = jest.fn().mockResolvedValue({ copied: true, entry: {} });
    render(<Host controller={controllerWith(copy)} />);
    await typeQuery('lotus');
    await choose();
    await click('Copy');
    await click('Reopen');
    expectFresh();
  });
});

describe('GlossaryCopyDialog with an entry already here', () => {
  it('copies nothing until Copy anyway is pressed', async () => {
    mockOfAuthority.mockResolvedValue([entry('mine', HERE, 'Lotus flower')]);
    const copy = jest.fn().mockResolvedValue({ copied: true, entry: {} });
    render(<Host controller={controllerWith(copy)} />);
    await typeQuery('lotus');
    await choose();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(copy).not.toHaveBeenCalled();
    await click('Copy anyway');
    expect(copy).toHaveBeenCalledTimes(1);
  });
});
