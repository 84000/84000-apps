/**
 * Acceptance tests for DEV-884 criterion 1 (and the read-only side of 2): the
 * row's label menu offers "Edit Entry", which opens the entry panel.
 */
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  getGlossaryEntrySharedNames: jest.fn(async () => new Set<string>()),
  getGlossaryAuthorities: jest.fn(async () => []),
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GlossaryEntry } from '@eightyfourthousand/data-access';

import { GlossaryEntryPanel } from './GlossaryEntryPanel';
import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';

const entry = (uuid: string, english: string): GlossaryEntry => ({
  uuid,
  workUuid: 'w1',
  authorityUuid: 'auth-1',
  definition: '<p>def</p>',
  definitionRend: null,
  glossMode: 'match',
  names: [
    {
      glossaryUuid: uuid,
      nameUuid: `n-${uuid}`,
      nameAuthorityUuid: 'auth-1',
      language: 'en',
      content: english,
      contentTransformed: null,
      termType: 'translationMain',
      attestation: null,
    },
  ],
});

class FakeStack {
  version = 0;
  listeners = new Set<() => void>();
  constructor(
    private entries: GlossaryEntry[],
    private readOnly = false,
  ) {}
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getVersion = () => this.version;
  getFocusedUuid = () => null;
  getGlossaryEntry = (uuid: string) =>
    this.entries.find((e) => e.uuid === uuid) ?? null;
  getGlossary = () => null;
  getMeta = (uuid: string) => ({ uuid, label: 'g.1', type: 'glossary' });
  isReadOnly = () => this.readOnly;
  settleGlossaryEntry = jest.fn();
  /** Whether the entry panel was already open when each focus happened. */
  panelOpenAtFocus: boolean[] = [];
  focusPassage = jest.fn((uuid: string) => {
    void uuid;
    this.panelOpenAtFocus.push(!!document.querySelector('[role=dialog]'));
    return true;
  });
}

const rect = { top: 0, left: 0, width: 10, height: 10 };

const mount = async (readOnly = false, uuid = 'e2') => {
  const stack = new FakeStack(
    [entry('e1', 'first term'), entry('e2', 'second term')],
    readOnly,
  );
  const controller = stack as unknown as StackController;
  const onClose = jest.fn();
  render(
    <>
      <GlossaryRowMenu
        controller={controller}
        target={{ uuid, rect }}
        onClose={onClose}
      />
      <GlossaryEntryPanel controller={controller} />
    </>,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  return { user: userEvent.setup(), onClose, stack };
};

describe('[AC1] "Edit Entry" in the row label menu', () => {
  it('[AC1] offers Edit Entry beside Copy Link and Delete', async () => {
    await mount();
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /edit entry/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeTruthy();
  });

  it('[AC1] opens the panel for the menu row, not another', async () => {
    const { user } = await mount(false, 'e2');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: /edit entry/i }));
    const panel = await screen.findByRole('dialog');
    expect(panel.textContent).toContain('second term');
    expect(panel.textContent).not.toContain('first term');
  });

  it('[AC1] focuses the row before the panel opens', async () => {
    const { user, stack } = await mount(false, 'e2');
    await user.click(screen.getByRole('menuitem', { name: /edit entry/i }));
    await screen.findByRole('dialog');
    expect(stack.focusPassage).toHaveBeenCalled();
    expect(stack.focusPassage.mock.calls[0][0]).toBe('e2');
    expect(stack.panelOpenAtFocus).not.toContain(true);
  });

  it('[AC1] closes the menu when it is chosen', async () => {
    const { user, onClose } = await mount();
    await user.click(screen.getByRole('menuitem', { name: /edit entry/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('[AC1] opens the panel for the first row too', async () => {
    const { user } = await mount(false, 'e1');
    await user.click(screen.getByRole('menuitem', { name: /edit entry/i }));
    expect((await screen.findByRole('dialog')).textContent).toContain(
      'first term',
    );
  });
});

describe('[AC2] a read-only stack', () => {
  it('[AC2] offers Edit Entry and Copy Link but not Delete', async () => {
    await mount(true);
    expect(screen.getByRole('menuitem', { name: /edit entry/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).toBeNull();
  });

  it('[AC2] opens the panel without controls to change anything', async () => {
    const { user } = await mount(true);
    await user.click(screen.getByRole('menuitem', { name: /edit entry/i }));
    const panel = await screen.findByRole('dialog');
    expect(panel.textContent).toContain('second term');
    const live = Array.from(
      panel.querySelectorAll<HTMLElement>('button, input, select, textarea'),
    ).filter(
      (el) =>
        !(el as HTMLButtonElement).disabled &&
        !/close/i.test(el.textContent ?? ''),
    );
    expect(live.map((el) => el.outerHTML.slice(0, 60))).toEqual([]);
  });
});
