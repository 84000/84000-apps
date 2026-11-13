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
  getGlossaryEntry: async () => null,
  getGlossaryAuthorities: async () => [AUTHORITY],
  searchGlossaryAuthorities: async () => [],
  getGlossaryEntrySharedNames: async () => new Set(),
}));

const ENTRY: GlossaryEntry = {
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
};

const setup = async () => {
  const controller = {
    getGlossaryEntry: (uuid: string) => (uuid === 'e1' ? ENTRY : null),
    isReadOnly: () => false,
    subscribe: () => () => undefined,
    getVersion: () => 0,
    settleGlossaryEntry: jest.fn(),
  } as unknown as StackController;
  render(<GlossaryEntryPanel controller={controller} />);
  await act(async () => {
    openGlossaryEntryPanel(controller, 'e1');
  });
};

const panel = () => document.querySelector('[data-glossary-entry-panel]');

describe('GlossaryEntryPanel and Escape', () => {
  beforeEach(() => mockSave.mockReset());

  it('cancels a name being added without closing the dialog', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /an alternative/ }));
    });
    const input = screen.getByLabelText(/New English alternatives name/);
    fireEvent.change(input, { target: { value: 'half typed' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(panel()).not.toBeNull();
    expect(screen.queryByLabelText(/New English alternatives name/)).toBeNull();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('stops an authority search without closing the dialog', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Link another authority' }),
      );
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Search authorities'), {
        key: 'Escape',
      });
    });
    expect(panel()).not.toBeNull();
    expect(screen.queryByLabelText('Search authorities')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Link another authority' }),
    ).toBeTruthy();
  });

  it('closes the dialog on Escape elsewhere', async () => {
    await setup();
    await act(async () => {
      fireEvent.keyDown(
        screen.getByRole('button', { name: /an alternative/ }),
        { key: 'Escape' },
      );
    });
    expect(panel()).toBeNull();
  });
});
