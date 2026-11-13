import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  GlossaryAuthority,
  GlossaryEntry,
} from '@eightyfourthousand/data-access';

import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import type { StackController } from './StackController';
import { openGlossaryEntryPanel } from './glossary-entry-panel';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockSave = jest.fn();
const mockRead = jest.fn();
const AUTHORITY: GlossaryAuthority = {
  uuid: 'a1',
  headword: 'Indra',
  headwordLanguage: 'Sa-Ltn',
  definition: '<p>The standard Indra.</p>',
  names: [],
};
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  saveGlossaryEntry: (args: unknown) => mockSave(args),
  getGlossaryEntry: (args: unknown) => mockRead(args),
  getGlossaryAuthorities: async () => [AUTHORITY],
  searchGlossaryAuthorities: async () => [],
  getGlossaryEntrySharedNames: async () => new Set(),
}));

const entry = (overrides: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  uuid: 'e1',
  workUuid: 'w1',
  authorityUuid: 'a1',
  definition: '<p>The king of the gods.</p>',
  definitionRend: null,
  glossMode: 'match',
  names: [
    {
      glossaryUuid: 'e1',
      nameUuid: 'n-e1',
      nameAuthorityUuid: 'a1',
      language: 'en',
      content: 'Indra',
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
  ],
  ...overrides,
});

const setup = async () => {
  const controller = {
    getGlossaryEntry: (uuid: string) => (uuid === 'e1' ? entry() : null),
    isReadOnly: () => false,
    subscribe: () => () => undefined,
    getVersion: () => 0,
    settleGlossaryEntry: jest.fn(),
  } as unknown as StackController;
  render(<GlossaryEntryPanel controller={controller} />);
  const open = async () => {
    await act(async () => {
      openGlossaryEntryPanel(controller, 'e1');
    });
  };
  await open();
  return { open };
};

const panel = () => document.querySelector('[data-glossary-entry-panel]');
const conflict = () => document.querySelector('[data-glossary-entry-conflict]');

/** Choose a definition relation through the select, by keyboard. */
const choose = async (label: string) => {
  await act(async () => {
    fireEvent.keyDown(
      screen.getByRole('combobox', { name: 'Definition relation' }),
      { key: 'Enter' },
    );
  });
  await act(async () => {
    fireEvent.keyDown(screen.getByRole('option', { name: label }), {
      key: 'Enter',
    });
  });
};

beforeAll(() => {
  // Radix Select reaches for these, which jsdom lacks.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  mockSave.mockReset();
  mockRead.mockReset();
});

describe.each(['Done', 'Close'])('Closing the entry panel with %s', (name) => {
  const close = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name }));
    });
  };

  it('closes the panel and saves nothing', async () => {
    await setup();
    await close();
    expect(panel()).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('keeps a refused save to show again on reopening', async () => {
    mockSave.mockResolvedValue({
      success: false,
      reason: 'stale',
      error: 'changed',
    });
    mockRead.mockResolvedValue({
      status: 'found',
      entry: entry({ definitionRend: 'prependWithStandard' }),
    });
    const { open } = await setup();
    await choose('Use standard');
    expect(conflict()).not.toBeNull();
    await close();
    expect(panel()).toBeNull();
    await open();
    expect(conflict()).not.toBeNull();
  });
});
