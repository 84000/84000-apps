import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import type { Work } from '@eightyfourthousand/data-access';

import { EditorContextProvider, useEditorState } from './EditorProvider';
import type {
  EditorContextState,
  SaveHandler,
  SaveReport,
  UnconfirmedSave,
} from './editor-context';

// See PassageStackController.spec.ts — the client barrels leak
// `data-access/ssr`.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@eightyfourthousand/lib-instr', () => ({
  useFeatureFlagEnabled: () => false,
}));
jest.mock('@eightyfourthousand/lib-instr/static', () => ({
  isStaticFeatureEnabled: () => false,
}));
jest.mock('../shared/HoverCardProvider', () => ({
  HoverCardProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../shared/RestrictionWarning', () => ({
  RestrictionWarning: () => null,
}));

const mockGraphqlRequest = jest.fn();

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({ request: mockGraphqlRequest })),
  findWorkPassages: jest.requireActual('@eightyfourthousand/client-graphql')
    .findWorkPassages,
  hasPermission: jest.fn(async () => true),
  getBibliographyEntry: jest.fn(),
  getGlossaryInstance: jest.fn(),
  lookup: jest.fn(async () => null),
  getPassage: jest.fn(),
  getTranslationImprint: jest.fn(async () => undefined),
  getTranslationMetadataByUuid: jest.fn(),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
  getPassageSorts: jest.fn(),
  getWorkPassageUuids: jest.fn(),
}));

/** Whether the page draws its toasts, with Sonner. */
const mockSonner = { real: false };

jest.mock('@eightyfourthousand/design-system', () => {
  const actual = jest.requireActual('@eightyfourthousand/design-system');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    toast: jest.fn(),
    Toaster: () => (mockSonner.real ? createElement(actual.Toaster) : null),
  };
});

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getPassageSorts: jest.Mock;
  getWorkPassageUuids: jest.Mock;
};
const designSystem = jest.requireMock('@eightyfourthousand/design-system') as {
  toast: jest.Mock;
};

const work = {
  uuid: 'w1',
  title: 'Work',
  section: '',
  pages: 0,
  publicationDate: new Date(),
  publicationVersion: '0.0.0',
  restriction: false,
  toh: [],
} as unknown as Work;

let editorState: EditorContextState;
/** How many times the editors below the provider were mounted. */
let mounts = 0;

const Capture = () => {
  const state = useEditorState();
  useEffect(() => {
    editorState = state;
  });
  useEffect(() => {
    mounts += 1;
  }, []);
  return null;
};

/** What the registered stack holds, as its save handler reports it. */
const stack = {
  /** Passages changed since the last save. */
  unsaved: 0,
  /** Moves with every edit, even one that changes no count. */
  revision: 0,
  save: jest.fn<Promise<SaveReport>, []>(),
};

/** An edit to the stack, as typing does. */
const edit = (changes = 1) => {
  stack.unsaved += changes;
  stack.revision += 1;
};

/** A save of `p0` whose answer was lost. */
const lostSave = (unconfirmed?: Partial<UnconfirmedSave>): SaveReport => ({
  outcome: 'unknown',
  unconfirmed: {
    sent: ['p0'],
    inserted: [],
    deleted: [],
    newerChanges: () => stack.unsaved,
    restore: jest.fn(async () => undefined),
    ...unconfirmed,
  },
});

/** A save of a new passage `p0` whose answer was lost. */
const lostInsert = () => lostSave({ inserted: ['p0'] });

const registerStack = (handler?: Partial<SaveHandler>) =>
  act(() =>
    editorState.registerSaveHandler({
      save: stack.save,
      isDirty: () => stack.unsaved > 0,
      unsavedChanges: () => stack.unsaved,
      revision: () => String(stack.revision),
      ...handler,
    }),
  );

const mount = async () => {
  const view = render(
    <EditorContextProvider work={work}>
      <Capture />
    </EditorContextProvider>,
  );
  await waitFor(() => expect(mounts).toBe(1));
  registerStack();
  return view;
};

/** Press a toast's action, as its button does. */
const press = (action: { onClick: (event: unknown) => void }) =>
  action.onClick({ preventDefault: jest.fn() });

/** The passages the server holds, read back directly or through the API. */
let held: string[] = [];

/** What the server holds after a save whose answer was lost. */
const serverHolds = (...uuids: string[]) => {
  held = uuids;
};

/** The API's page of passages, as the reload probe asks for them. */
const apiPage = (_query: unknown, vars: { filter?: { uuids: string[] } }) => {
  const asked = vars.filter?.uuids;
  const nodes = (asked ? held.filter((u) => asked.includes(u)) : held)
    .slice(0, asked?.length || 1)
    .map((uuid) => ({ uuid }));
  return Promise.resolve({ work: { uuid: 'w1', passages: { nodes } } });
};

/** The page the server answers with when its read fails. */
const failedRead = { work: { uuid: 'w1', passages: { nodes: [] } } };

const toasted = () => designSystem.toast.mock.calls.map(([title]) => title);
const lastToast = () =>
  designSystem.toast.mock.calls[designSystem.toast.mock.calls.length - 1];

describe('saving', () => {
  beforeAll(() => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  beforeEach(() => {
    mounts = 0;
    mockSonner.real = false;
    stack.unsaved = 0;
    stack.revision = 0;
    stack.save.mockReset();
    designSystem.toast.mockReset();
    dataAccess.getPassageSorts.mockReset();
    dataAccess.getWorkPassageUuids.mockImplementation(
      async ({ limit }: { limit: number }) => held.slice(0, limit),
    );
    mockGraphqlRequest.mockReset();
    mockGraphqlRequest.mockImplementation(apiPage);
    dataAccess.getPassageSorts.mockImplementation(
      async ({ uuids }: { uuids: string[] }) =>
        new Map(uuids.filter((u) => held.includes(u)).map((u) => [u, 1])),
    );
    serverHolds();
  });

  it('says what a save wrote', async () => {
    await mount();
    edit();
    stack.save.mockImplementation(async () => {
      stack.unsaved = 0;
      return { outcome: 'saved' };
    });

    await act(() => editorState.save());

    expect(toasted()).toEqual(['Content saved']);
    expect(editorState.dirtyStore.getSnapshot()).toBe(false);
  });

  it('keeps the edits of a save that failed', async () => {
    await mount();
    edit();
    stack.save.mockResolvedValue({ outcome: 'failed' });

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(toasted()).toEqual(['Error saving content.']);
    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);
  });

  it('reports a save that threw as failed', async () => {
    await mount();
    stack.save.mockRejectedValue(new Error('boom'));

    await act(() => editorState.save());

    expect(toasted()).toEqual(['Error saving content.']);
    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
  });

  it('reads the editors again once the save shows it went through', async () => {
    await mount();
    stack.save.mockResolvedValue(lostInsert());
    serverHolds('p0');

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(dataAccess.getPassageSorts).toHaveBeenCalledWith(
      expect.objectContaining({ uuids: ['p0'] }),
    );
    expect(toasted()).toEqual(['Your last save went through.']);
    // A fresh session: nothing left over to resend.
    expect(editorState.dirtyStore.getSnapshot()).toBe(false);
  });

  it('keeps the edits of a save that did not go through', async () => {
    await mount();
    const lost = lostInsert();
    stack.save.mockResolvedValueOnce(lost);

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(lost.unconfirmed?.restore).toHaveBeenCalled();
    expect(toasted()).toEqual(['Your last save did not go through.']);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    stack.save.mockResolvedValueOnce({ outcome: 'saved' });
    await act(() => editorState.save());
    expect(stack.save).toHaveBeenCalledTimes(2);
  });

  it('pauses saving until the server can be read', async () => {
    await mount();
    stack.save.mockResolvedValue(lostInsert());
    dataAccess.getPassageSorts.mockResolvedValueOnce(null);

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    serverHolds('p0');
    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    // The save is never sent again, only read back.
    expect(stack.save).toHaveBeenCalledTimes(1);
  });

  // The read-back worked, but the reload would not: replacing the editors
  // now would leave them empty.
  it('keeps the editors while the work cannot be read', async () => {
    await mount();
    stack.save.mockResolvedValue(lostInsert());
    serverHolds('p0');
    mockGraphqlRequest.mockResolvedValueOnce(failedRead);

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(stack.save).toHaveBeenCalledTimes(1);
  });

  it('asks before a reload discards an edit made while checking', async () => {
    await mount();
    stack.save.mockResolvedValue(lostInsert());
    serverHolds('p0');
    mockGraphqlRequest.mockImplementationOnce(async (...args) => {
      edit();
      return apiPage(...(args as Parameters<typeof apiPage>));
    });

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
  });

  it('reloads once, however often Reload or Save is pressed', async () => {
    await mount();
    stack.save.mockImplementation(async () => {
      edit();
      return lostInsert();
    });
    serverHolds('p0');
    await act(() => editorState.save());
    const { action } = lastToast()[1];
    const probes: (() => void)[] = [];
    mockGraphqlRequest.mockImplementation(
      (...args) =>
        new Promise((resolve) =>
          probes.push(() =>
            resolve(apiPage(...(args as Parameters<typeof apiPage>))),
          ),
        ),
    );

    act(() => press(action));
    act(() => press(action));
    await act(() => editorState.save());
    await act(async () => probes.forEach((resolveProbe) => resolveProbe()));

    await waitFor(() => expect(mounts).toBe(2));
    expect(probes).toHaveLength(1);
    expect(dataAccess.getPassageSorts).toHaveBeenCalledTimes(1);
  });

  // The same passages stay changed, but not the same changes.
  it('asks again when an edit while reloading changes no count', async () => {
    await mount();
    stack.save.mockImplementation(async () => {
      edit();
      return lostInsert();
    });
    serverHolds('p0');
    await act(() => editorState.save());
    const asked = toasted().length;
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
    mockGraphqlRequest.mockImplementationOnce(async (...args) => {
      edit(0);
      return apiPage(...(args as Parameters<typeof apiPage>));
    });

    await act(async () => press(lastToast()[1].action));

    expect(mounts).toBe(1);
    expect(toasted()).toHaveLength(asked + 1);
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
  });

  it('keeps the warning up when Reload has to ask again', async () => {
    mockSonner.real = true;
    const sonner = jest.requireActual('@eightyfourthousand/design-system');
    designSystem.toast.mockImplementation(sonner.toast);
    await mount();
    stack.save.mockImplementation(async () => {
      edit();
      return lostInsert();
    });
    serverHolds('p0');
    await act(() => editorState.save());
    await screen.findByText(/discard 1 unsaved change\./);
    edit();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await screen.findByText(/discard 2 unsaved changes\./);
    // Past the time Sonner takes to remove a dismissed toast.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(screen.getByText(/discard 2 unsaved changes\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(mounts).toBe(1);
    act(() => sonner.toast.dismiss());
  });

  it('drops Reload from a warning that no longer offers it', async () => {
    mockSonner.real = true;
    const sonner = jest.requireActual('@eightyfourthousand/design-system');
    designSystem.toast.mockImplementation(sonner.toast);
    await mount();
    stack.save.mockImplementation(async () => {
      edit();
      return lostInsert();
    });
    serverHolds('p0');
    await act(() => editorState.save());
    await screen.findByText(/discard 1 unsaved change\./);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await screen.findByText(/now shows what is saved/);
    expect(mounts).toBe(2);
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    act(() => sonner.toast.dismiss());
  });

  it('settles nothing when a save answers after the session is gone', async () => {
    const view = await mount();
    let answer: (value: SaveReport) => void = () => undefined;
    stack.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    serverHolds('p0');
    const saving = editorState.save();

    view.unmount();
    await act(async () => {
      answer(lostInsert());
      await saving;
    });

    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
    expect(toasted()).toEqual([]);
  });

  it('settles nothing once the session is gone', async () => {
    const view = await mount();
    stack.save.mockImplementation(async () => {
      edit();
      return lostInsert();
    });
    serverHolds('p0');
    await act(() => editorState.save());
    const { action } = lastToast()[1];
    let resolveProbe = () => undefined as void;
    mockGraphqlRequest.mockImplementationOnce(
      (...args) =>
        new Promise((resolve) => {
          resolveProbe = () =>
            resolve(apiPage(...(args as Parameters<typeof apiPage>)));
        }),
    );
    act(() => press(action));
    const asked = toasted().length;

    view.unmount();
    await act(async () => resolveProbe());

    expect(toasted()).toHaveLength(asked);
  });

  // Deleting every passage leaves the work empty, which the API reads as
  // empty whether or not the read worked.
  it('reloads a work its save emptied', async () => {
    await mount();
    edit();
    stack.save.mockResolvedValue(lostSave({ sent: [], deleted: ['s1'] }));
    await act(() => editorState.save());
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');

    await act(async () => press(lastToast()[1].action));

    await waitFor(() => expect(mounts).toBe(2));
  });

  it('asks before a reload discards a passage added during the save', async () => {
    await mount();
    stack.save.mockImplementation(async () => {
      edit();
      return lostInsert();
    });
    serverHolds('p0');

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    const [title, { description, action }] = lastToast();
    expect(title).toBe('Your last save went through, but its answer was lost.');
    expect(description).toContain('discard 1 unsaved change.');
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    await act(async () => press(action));
    await waitFor(() => expect(mounts).toBe(2));
    expect(stack.save).toHaveBeenCalledTimes(1);
  });

  it('asks before a reload discards edits to a passage it sent', async () => {
    await mount();
    stack.save.mockImplementation(async () => {
      edit(2);
      return lostSave();
    });
    serverHolds('p0');

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    const [title, { description }] = lastToast();
    expect(title).toBe('Your last save may have gone through.');
    expect(description).toContain('discard 2 unsaved changes.');
  });

  // Only content was sent, so sending it again writes the same thing.
  it('leaves a save that only changed content for the next save', async () => {
    await mount();
    edit();
    stack.save.mockResolvedValue(lostSave({ replayable: true }));

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
    expect(toasted()).toEqual(['Your last save could not be confirmed.']);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);
  });
});
