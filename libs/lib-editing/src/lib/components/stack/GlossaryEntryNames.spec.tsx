import { useSyncExternalStore } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  GlossaryEntry,
  GlossaryEntryName,
} from '@eightyfourthousand/data-access';
import { toEwtsWithWarnings } from '@eightyfourthousand/lib-tibetan';

import { GlossaryEntryNames } from './GlossaryEntryNames';
import { useGlossaryEntrySaves } from './GlossaryEntrySaves';
import type { StackController } from './StackController';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSave = jest.fn();
const mockShared = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  saveGlossaryEntry: (args: unknown) => mockSave(args),
  getGlossaryEntry: jest.fn(),
  getGlossaryEntrySharedNames: (args: unknown) => mockShared(args),
}));

const name = (
  content: string,
  language: string,
  overrides: Partial<GlossaryEntryName> = {},
): GlossaryEntryName => ({
  glossaryUuid: `g-${content}`,
  nameUuid: `n-${content}`,
  nameAuthorityUuid: 'a1',
  language,
  content,
  contentTransformed: null,
  termType: null,
  attestation: null,
  ...overrides,
});

const MAIN = name('Indra', 'en', { termType: 'translationMain' });
const ALTERNATIVE = name('lord of gods', 'en', {
  termType: 'translationAlternative',
});
const TIBETAN = name('brgya byin', 'Bo-Ltn', {
  contentTransformed: 'བརྒྱ་བྱིན།',
  attestation: 'attestedSource',
});
const SANSKRIT = name('Śakra', 'Sa-Ltn');
const OTHER = name('Taishakuten', 'ja');

const entryOf = (names: GlossaryEntryName[]): GlossaryEntry => ({
  uuid: 'e1',
  workUuid: 'w1',
  authorityUuid: 'a1',
  definition: null,
  definitionRend: null,
  glossMode: 'match',
  names,
});

const fakeController = (entry: GlossaryEntry, readOnly: boolean) => {
  let held = entry;
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    getGlossaryEntry: () => held,
    isReadOnly: () => readOnly,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    settleGlossaryEntry: (_: string, next: GlossaryEntry) => {
      held = next;
      version += 1;
      listeners.forEach((listener) => listener());
    },
  } as unknown as StackController;
};

const Harness = ({
  controller,
  readOnly,
}: {
  controller: StackController;
  readOnly: boolean;
}) => {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  const entry = controller.getGlossaryEntry('e1') as GlossaryEntry;
  const saves = useGlossaryEntrySaves(controller, entry);
  return <GlossaryEntryNames entry={entry} saves={saves} readOnly={readOnly} />;
};

const setup = async ({
  names = [MAIN, ALTERNATIVE, TIBETAN, SANSKRIT],
  readOnly = false,
  shared = [] as string[] | null,
} = {}) => {
  mockShared.mockResolvedValue(shared && new Set(shared));
  const controller = fakeController(entryOf(names), readOnly);
  render(<Harness controller={controller} readOnly={readOnly} />);
  await act(async () => undefined);
  return controller;
};

const group = (kind: string, language?: string) =>
  document.querySelector(
    `[data-glossary-name-group="${kind}"]${language ? `[data-language="${language}"]` : ''}`,
  ) as HTMLElement;

const row = (content: string) =>
  document.querySelector(`[data-glossary-name="${content}"]`) as HTMLElement;

const savedNames = (call = 0) =>
  mockSave.mock.calls[call][0].after.names as GlossaryEntryName[];

beforeEach(() => {
  mockSave.mockReset();
  mockShared.mockReset();
  mockSave.mockImplementation(
    async ({ after }: { after: { names: GlossaryEntryName[] } }) => ({
      success: true,
      entries: [entryOf(after.names)],
    }),
  );
});

describe('GlossaryEntryNames', () => {
  it('shows each group with its names, Tibetan as script and Wylie', async () => {
    await setup();
    expect(group('main').textContent).toContain('Indra');
    expect(group('alternatives').textContent).toContain('lord of gods');
    expect(group('alternatives').textContent).toContain(
      'Readers never see these names',
    );
    const tibetan = group('language', 'Bo-Ltn');
    expect(tibetan.textContent).toContain('བརྒྱ་བྱིན།');
    expect(tibetan.textContent).toContain('brgya byin');
    expect(group('language', 'Sa-Ltn').textContent).toContain('Śakra');
  });

  it('lets the main name be edited but not removed', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Edit Indra' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Indra' })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit Indra' }));
    });
    fireEvent.change(screen.getByDisplayValue('Indra'), {
      target: { value: 'Śakra the god' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(savedNames()[0]).toMatchObject({
      glossaryUuid: 'g-Indra',
      content: 'Śakra the god',
    });
  });

  it('removes an alternative, saving the names without it', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove lord of gods' }),
      );
    });
    expect(savedNames().map((n) => n.content)).toEqual([
      'Indra',
      'brgya byin',
      'Śakra',
    ]);
    expect(row('lord of gods')).toBeNull();
  });

  it('adds an alternative, refusing one already in the group', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /an alternative/ }));
    });
    const input = screen.getByLabelText(/New English alternatives name/);
    fireEvent.change(input, { target: { value: 'Lord of Gods' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('already has');
    expect(mockSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'king of gods' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(savedNames().at(-1)).toEqual({
      language: 'en',
      content: 'king of gods',
      contentTransformed: null,
      termType: 'translationAlternative',
      attestation: null,
    });
  });

  it('adds a Sanskrit name', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /a Sanskrit name/ }));
    });
    fireEvent.change(screen.getByLabelText(/New Sanskrit name/), {
      target: { value: 'Devendra' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(savedNames().at(-1)).toMatchObject({
      language: 'Sa-Ltn',
      content: 'Devendra',
      termType: null,
    });
  });

  it('gives attestations to the language groups only, and saves a change', async () => {
    await setup();
    expect(screen.queryByLabelText('Attestation of Indra')).toBeNull();
    expect(screen.queryByLabelText('Attestation of lord of gods')).toBeNull();
    const picker = screen.getByLabelText(
      'Attestation of brgya byin',
    ) as HTMLSelectElement;
    expect(picker.value).toBe('attestedSource');
    expect([...picker.options].map((option) => option.textContent)).toContain(
      'No attestation',
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Attestation of Śakra'), {
        target: { value: 'reconstructedPhonetic' },
      });
    });
    expect(savedNames().find((n) => n.content === 'Śakra')?.attestation).toBe(
      'reconstructedPhonetic',
    );
  });

  it('marks a shared name, which can be removed and attested but not edited', async () => {
    await setup({ shared: ['n-Śakra'] });
    expect(
      row('Śakra').querySelector('[data-glossary-name-shared]'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Śakra' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Śakra' })).toBeTruthy();
    expect(screen.getByLabelText('Attestation of Śakra')).toBeTruthy();
    expect(
      row('Indra').querySelector('[data-glossary-name-shared]'),
    ).toBeNull();
  });

  it('edits no name’s text when shared names could not be read', async () => {
    await setup({ shared: null });
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.getByText(/could not be read/)).toBeTruthy();
  });

  it('lists another language under its code, removable only', async () => {
    await setup({ names: [MAIN, OTHER] });
    const other = group('other', 'ja');
    expect(other.textContent).toContain('ja');
    expect(other.textContent).toContain('Taishakuten');
    expect(
      screen.getByRole('button', { name: 'Remove Taishakuten' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Edit Taishakuten' }),
    ).toBeNull();
    expect(screen.queryByLabelText('Attestation of Taishakuten')).toBeNull();
    expect(other.querySelector('button[class*="self-start"]')).toBeNull();
  });

  it('shows the root under its language for an entry with no English name', async () => {
    await setup({ names: [SANSKRIT, TIBETAN] });
    expect(group('main')).toBeNull();
    expect(row('Śakra').textContent).toContain('Root name');
    expect(screen.queryByRole('button', { name: 'Remove Śakra' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Śakra' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /an alternative/ })).toBeTruthy();
    expect(screen.queryByText(/main English/i)).toBeNull();
  });

  it('edits a Tibetan name by its script, its Wylie generated again', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit brgya byin' }));
    });
    const input = screen.getByLabelText(
      'Tibetan name in script',
    ) as HTMLInputElement;
    expect(input.value).toBe('བརྒྱ་བྱིན།');
    fireEvent.change(input, { target: { value: 'སེམས།' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(savedNames().find((n) => n.language === 'Bo-Ltn')).toMatchObject({
      glossaryUuid: TIBETAN.glossaryUuid,
      content: 'sems',
      contentTransformed: 'སེམས།',
    });
  });

  it('refuses a Tibetan name whose Wylie a stored name has', async () => {
    await setup({
      names: [MAIN, name('sems', 'Bo-Ltn')],
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /a Tibetan name/ }));
    });
    fireEvent.change(screen.getByLabelText('Tibetan name in script'), {
      target: { value: 'སེམས།' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('already has');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('enters a Tibetan name as script, its Wylie shown before saving', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /a Tibetan name/ }));
    });
    fireEvent.change(screen.getByLabelText('Tibetan name in script'), {
      target: { value: 'སེམས།' },
    });
    expect(
      document.querySelector('[data-glossary-name-wylie]')?.textContent,
    ).toContain('sems');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(savedNames().at(-1)).toMatchObject({
      language: 'Bo-Ltn',
      content: 'sems',
      contentTransformed: 'སེམས།',
    });
  });

  it('shows conversion warnings beside the name, and still saves it', async () => {
    const odd = toEwtsWithWarnings('ཀཨི', { finalShad: 'drop' });
    const [warning] = odd.warnings;
    expect(warning).toBeTruthy();
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /a Tibetan name/ }));
    });
    fireEvent.change(screen.getByLabelText('Tibetan name in script'), {
      target: { value: 'ཀཨི' },
    });
    expect(
      document.querySelector('[data-glossary-name-warnings]')?.textContent,
    ).toContain(warning);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(savedNames().at(-1)).toMatchObject({
      content: odd.ewts,
      contentTransformed: 'ཀཨི',
    });
    expect(
      row(odd.ewts).querySelector('[data-glossary-name-warnings]')?.textContent,
    ).toContain(warning);
  });

  it('shows the names without controls when read-only', async () => {
    await setup({ readOnly: true });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.querySelectorAll('select')).toHaveLength(0);
    expect(row('brgya byin').textContent).toContain('Attested Source');
  });
});
