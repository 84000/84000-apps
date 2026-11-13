import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  GlossaryCopySource,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import { GlossaryCopyDialog } from './GlossaryCopyDialog';
import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';

// DEV-911 acceptance tests, written from the issue's criteria: the dialog
// that copies a glossary entry from another work (criteria 1, 2 and 5, and a
// refused copy). The data-access reads and the controller are faked.

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

const THIS_WORK = 'work-this';

const entry = (
  uuid: string,
  authorityUuid: string,
  english: string,
  rest: Partial<GlossaryEntry> = {},
): GlossaryEntry => ({
  uuid,
  workUuid: 'work-other',
  authorityUuid,
  definition: null,
  definitionRend: null,
  glossMode: 'match',
  names: [
    {
      glossaryUuid: `${uuid}-row`,
      nameUuid: `${uuid}-name`,
      nameAuthorityUuid: authorityUuid,
      language: 'en',
      content: english,
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
  ],
  ...rest,
});

const INDRA = entry('src-indra', 'auth-indra', 'Lord of Heaven', {
  definition:
    '<p>Ruler of the gods in the Vedic tradition and in the Buddhist cosmology.</p>',
  names: [
    ...entry('src-indra', 'auth-indra', 'Lord of Heaven').names,
    {
      glossaryUuid: 'src-indra-sa',
      nameUuid: 'src-indra-sa-name',
      nameAuthorityUuid: 'auth-indra',
      language: 'Sa-Ltn',
      content: 'Śakra',
      contentTransformed: null,
      termType: null,
      attestation: 'attestedSource',
    },
    {
      glossaryUuid: 'src-indra-bo',
      nameUuid: 'src-indra-bo-name',
      nameAuthorityUuid: 'auth-indra',
      language: 'Bo-Ltn',
      content: 'dbang po',
      contentTransformed: 'དབང་པོ',
      termType: null,
      attestation: null,
    },
  ],
});

const BRAHMA = entry('src-brahma', 'auth-brahma', 'Creator Deity', {
  definition: '<p>Chief of the form realm gods.</p>',
});

const sourceOf = (
  e: GlossaryEntry,
  toh: string,
  title: string,
  headword: string,
): GlossaryCopySource => ({
  entry: e,
  label: 'g.9',
  work: { uuid: e.workUuid, toh, title },
  headword,
  headwordLanguage: 'Sa-Ltn',
});

const RESULTS = [
  sourceOf(INDRA, 'toh145', 'The Jewel Torch Dhāraṇī', 'indra-headword'),
  sourceOf(
    { ...BRAHMA, workUuid: 'work-third' },
    'toh251',
    'The Four Factors Sūtra',
    'brahma-headword',
  ),
];

// The entry this work already has for Indra's authority.
const EXISTING = {
  ...entry('here-indra', 'auth-indra', 'Sovereign of the Gods'),
  workUuid: THIS_WORK,
};

const setup = ({ open = true } = {}) => {
  const copy = jest.fn();
  const onOpenChange = jest.fn();
  const controller = {
    getGlossary: () => ({ work: { workUuid: THIS_WORK } }),
    getMeta: (uuid: string) =>
      uuid === EXISTING.uuid ? { uuid, label: 'g.3', type: 'glossary' } : null,
    getGlossaryEntry: () => undefined,
    copyGlossaryEntry: copy,
  } as unknown as StackController;
  const view = render(
    <GlossaryCopyDialog
      controller={controller}
      open={open}
      onOpenChange={onOpenChange}
    />,
  );
  return { copy, onOpenChange, controller, view };
};

const searchBox = () => screen.getByLabelText('Search other works');

/** Type a query and let the debounce, and the search it triggers, settle. */
const searchFor = async (query: string) => {
  fireEvent.change(searchBox(), { target: { value: query } });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

const text = () => document.body.textContent ?? '';

/** The step that copies, whatever it is called: a button that begins "Copy". */
const copyButtons = () =>
  screen.queryAllByRole('button', { name: /^copy\b/i }) as HTMLElement[];

/** Choose a result, confirming it when the dialog asks before copying. */
const choose = async (match: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByText(match));
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockSearch.mockReset().mockResolvedValue(RESULTS);
  mockOfAuthority.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Copy from Another Work: the menu item and the dialog (criterion 1)', () => {
  it("offers the item in a glossary row's label menu, which opens the search", async () => {
    const controller = {
      getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
      getGlossaryEntry: () => entry('e1', 'a1', 'Indra'),
      getGlossary: () => ({ work: { workUuid: THIS_WORK } }),
      deleteGlossaryEntry: jest.fn(),
      copyGlossaryEntry: jest.fn(),
    } as unknown as StackController;
    const target = {
      uuid: 'e1',
      rect: { top: 0, left: 0, width: 1, height: 1 },
    };
    const onClose = jest.fn();
    const view = render(
      <GlossaryRowMenu
        controller={controller}
        target={target}
        onClose={onClose}
      />,
    );
    expect(screen.queryByLabelText('Search other works')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('Copy from Another Work'));
    });
    // Choosing an item closes the menu, which the stack does by clearing it.
    view.rerender(
      <GlossaryRowMenu
        controller={controller}
        target={null}
        onClose={onClose}
      />,
    );
    await act(async () => undefined);

    expect(searchBox()).toBeTruthy();
  });

  it('draws nothing while closed', () => {
    setup({ open: false });
    expect(screen.queryByLabelText('Search other works')).toBeNull();
  });

  it('searches other works for what is typed, after a pause, for this work', async () => {
    setup();
    fireEvent.change(searchBox(), { target: { value: 'indra' } });
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(mockSearch).not.toHaveBeenCalledWith(
      expect.objectContaining({ query: 'indra' }),
    );

    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    // `workUuid` is the work copied into: the search leaves its entries out.
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: THIS_WORK, query: 'indra' }),
    );
  });

  it('searches once for a run of keystrokes, not once for each', async () => {
    setup();
    for (const value of ['i', 'in', 'ind', 'indr', 'indra']) {
      fireEvent.change(searchBox(), { target: { value } });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    const queries = mockSearch.mock.calls.map(([args]) => args.query);
    expect(queries).toContain('indra');
    for (const partial of ['i', 'in', 'ind', 'indr']) {
      expect(queries).not.toContain(partial);
    }
  });
});

describe('Copy from Another Work: results (criterion 2)', () => {
  it("shows each result's work, names, definition and authority headword", async () => {
    setup();
    await searchFor('indra');

    // The work: its Toh and its title.
    expect(text()).toMatch(/toh\s*145/i);
    expect(text()).toContain('The Jewel Torch Dhāraṇī');
    expect(text()).toMatch(/toh\s*251/i);
    expect(text()).toContain('The Four Factors Sūtra');

    // Its names: English, Sanskrit and Tibetan.
    expect(text()).toContain('Lord of Heaven');
    expect(text()).toContain('Śakra');
    expect(text()).toMatch(/དབང་པོ|dbang po/);
    expect(text()).toContain('Creator Deity');

    // The start of its definition, as text rather than markup.
    expect(text()).toContain('Ruler of the gods in the Vedic tradition');
    expect(text()).toContain('Chief of the form realm gods.');
    expect(text()).not.toContain('<p>');

    // Its authority's headword.
    expect(text()).toContain('indra-headword');
    expect(text()).toContain('brahma-headword');
  });

  it('copies nothing until a result is chosen', async () => {
    const { copy } = setup();
    await searchFor('indra');
    expect(copy).not.toHaveBeenCalled();
  });
});

describe('Copy from Another Work: already here (criterion 5)', () => {
  it('says so, and shows the entry this work already has, before copying', async () => {
    mockOfAuthority.mockResolvedValue([EXISTING]);
    const { copy } = setup();
    await searchFor('indra');
    await choose('indra-headword');

    // It asked about this work's entries of the chosen entry's authority.
    expect(mockOfAuthority).toHaveBeenCalledWith(
      expect.objectContaining({
        workUuid: THIS_WORK,
        authorityUuid: 'auth-indra',
      }),
    );
    expect(text()).toMatch(/already/i);
    // The existing entry: its label here and its name.
    expect(text()).toContain('g.3');
    expect(text()).toContain('Sovereign of the Gods');
    // Nothing has been copied yet.
    expect(copy).not.toHaveBeenCalled();
  });

  it('still allows copying anyway', async () => {
    mockOfAuthority.mockResolvedValue([EXISTING]);
    const { copy } = setup();
    copy.mockResolvedValue({ copied: true, entry: INDRA });
    await searchFor('indra');
    await choose('indra-headword');

    const [confirm] = copyButtons();
    expect(confirm).toBeTruthy();
    expect(confirm.hasAttribute('disabled')).toBe(false);
    await act(async () => {
      fireEvent.click(confirm);
    });

    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy.mock.calls[0][0]).toEqual(INDRA);
  });

  it('says nothing of the kind when this work has no entry for the authority', async () => {
    mockOfAuthority.mockResolvedValue([]);
    setup();
    await searchFor('indra');
    await choose('indra-headword');
    expect(mockOfAuthority).toHaveBeenCalled();
    expect(text()).not.toMatch(/already/i);
  });
});

describe('Copy from Another Work: copying', () => {
  it('copies the chosen entry, and closes once it is copied', async () => {
    const { copy, onOpenChange } = setup();
    copy.mockResolvedValue({ copied: true, entry: INDRA });
    await searchFor('indra');
    await choose('indra-headword');
    // Choosing may copy at once, or ask for a confirmation first.
    const [confirm] = copyButtons();
    if (confirm) {
      await act(async () => {
        fireEvent.click(confirm);
      });
    }

    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy.mock.calls[0][0]).toEqual(INDRA);
    expect(copy.mock.calls[0][1]).toEqual(
      expect.objectContaining({ client: expect.anything() }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open with the reason when the copy is refused', async () => {
    const { copy, onOpenChange } = setup();
    copy.mockResolvedValue({ copied: false, error: 'Not allowed' });
    await searchFor('indra');
    await choose('indra-headword');
    const [confirm] = copyButtons();
    if (confirm) {
      await act(async () => {
        fireEvent.click(confirm);
      });
    }

    expect(copy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('Not allowed');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(searchBox()).toBeTruthy();
  });
});
