import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { ClientError } from 'graphql-request';
import { XmlElement } from 'yjs';
import type { Work } from '@eightyfourthousand/data-access';

import { EditorContextProvider, useEditorState } from './EditorProvider';
import type {
  EditorContextState,
  SaveHandler,
  UnconfirmedSave,
} from './editor-context';
import { translationSSRExtensions } from './extensions/translationSSRExtensions';
import TranslationDocument from './extensions/TranslationDocument';
import TranslationMetadata from './extensions/TranslationMetadata';
import { PassageNode } from './extensions/Passage/PassageNode';

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
  RequestNotSentError: jest.requireActual('@eightyfourthousand/client-graphql')
    .RequestNotSentError,
  createGraphQLClient: jest.fn(() => ({ request: mockGraphqlRequest })),
  findWorkPassages: jest.requireActual('@eightyfourthousand/client-graphql')
    .findWorkPassages,
  hasPermission: jest.fn(async () => true),
  savePassages: jest.fn(),
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

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  RequestNotSentError: new (cause: unknown) => Error;
  savePassages: jest.Mock;
};
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

const extensions = [
  ...translationSSRExtensions.filter(
    (extension) =>
      !['doc', 'passage'].includes((extension as { name?: string }).name ?? ''),
  ),
  TranslationDocument,
  PassageNode,
  // Declares the uuid attributes.
  TranslationMetadata,
];

const passage = (uuid: string, text: string) => ({
  type: 'passage',
  attrs: { uuid, label: '1.1', sort: 1, type: 'translation' },
  content: [
    {
      type: 'paragraph',
      attrs: { uuid: `para-${uuid}` },
      content: [{ type: 'text', text }],
    },
  ],
});

/** A paginated editor holding one passage the last save has not seen. */
const editorWithAnEdit = () =>
  new Editor({
    element: document.createElement('div'),
    extensions,
    content: { type: 'translation', content: [passage('p0', 'edited')] },
  });

const mount = async () => {
  const view = render(
    <EditorContextProvider work={work}>
      <Capture />
    </EditorContextProvider>,
  );
  await waitFor(() => expect(mounts).toBe(1));
  act(() => editorState.setEditor('main', editorWithAnEdit()));
  return view;
};

/** Press a toast's action, as its button does. */
const press = (action: { onClick: (event: unknown) => void }) =>
  action.onClick({ preventDefault: jest.fn() });

/** Add a passage to the paginated editor, as typing a new one does. */
const addPassage = (uuid: string) => {
  const editor = editorState.getEditor('main');
  editor?.commands.insertContentAt(
    editor.state.doc.content.size,
    passage(uuid, 'new'),
  );
};

/**
 * Track `main` as saved, holding p0, with the fragment the editors bind to,
 * and return how to edit p0 there as typing does.
 */
const observeSavedPassage = () => {
  const fragment = editorState.getFragment('main');
  const element = new XmlElement('passage');
  fragment.insert(0, [element]);
  element.setAttribute('uuid', 'p0');
  act(() => editorState.startObserving('main'));
  let revision = 0;
  return () => element.setAttribute('revision', String(++revision));
};

const lostAnswer = {
  success: false,
  savedCount: 0,
  passages: [],
  renumberedPassages: [],
  error: 'The save may have been applied: fetch failed',
  outcomeUnknown: true,
};

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

/** A second editing surface, as the passage stack registers. */
const registerStack = (handler: Partial<SaveHandler>) =>
  act(() =>
    editorState.registerSaveHandler({
      save: async () => ({ outcome: 'none' }),
      isDirty: () => false,
      unsavedChanges: () => 0,
      ...handler,
    }),
  );

const toasted = () => designSystem.toast.mock.calls.map(([title]) => title);
const lastToast = () =>
  designSystem.toast.mock.calls[designSystem.toast.mock.calls.length - 1];
const sentUuids = (call: number) =>
  clientGraphql.savePassages.mock.calls[call][0].passages.map(
    (p: { uuid: string }) => p.uuid,
  );

const clientError = (status: number, errors?: { message: string }[]) =>
  new ClientError(
    {
      status,
      errors,
      headers: new Headers(),
      body: '',
    } as unknown as ConstructorParameters<typeof ClientError>[0],
    { query: 'mutation SavePassages' },
  );

describe('saving the paginated editors', () => {
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
    designSystem.toast.mockReset();
    clientGraphql.savePassages.mockReset();
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

  it('reads the editors again once the save shows it went through', async () => {
    await mount();
    clientGraphql.savePassages.mockResolvedValue(lostAnswer);
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

  it('reads the editors again when no answer arrived', async () => {
    await mount();
    clientGraphql.savePassages.mockRejectedValue(new TypeError('fetch failed'));
    serverHolds('p0');

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(toasted()).toEqual(['Your last save went through.']);
  });

  it('keeps the edits of a save that did not go through', async () => {
    await mount();
    clientGraphql.savePassages.mockResolvedValueOnce(lostAnswer);

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(toasted()).toEqual(['Your last save did not go through.']);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    clientGraphql.savePassages.mockResolvedValueOnce({
      success: true,
      savedCount: 1,
      passages: [],
      renumberedPassages: [],
    });
    await act(() => editorState.save());
    expect(sentUuids(1)).toEqual(['p0']);
  });

  it('pauses saving until the server can be read', async () => {
    await mount();
    clientGraphql.savePassages.mockRejectedValue(new TypeError('fetch failed'));
    dataAccess.getPassageSorts.mockResolvedValueOnce(null);

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    serverHolds('p0');
    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    // The save is never sent again, only read back.
    expect(clientGraphql.savePassages).toHaveBeenCalledTimes(1);
  });

  // The read-back worked, but the reload would not: replacing the editors
  // now would leave them empty.
  it('keeps the editors while the work cannot be read', async () => {
    await mount();
    clientGraphql.savePassages.mockResolvedValue(lostAnswer);
    serverHolds('p0');
    mockGraphqlRequest.mockResolvedValueOnce(failedRead);

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(editorState.getEditor('main')?.getText().trim()).toBe('edited');
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(clientGraphql.savePassages).toHaveBeenCalledTimes(1);
  });

  it('asks before a reload discards an edit made while checking', async () => {
    await mount();
    clientGraphql.savePassages.mockResolvedValue(lostAnswer);
    serverHolds('p0');
    mockGraphqlRequest.mockImplementationOnce(async (...args) => {
      addPassage('p1');
      return apiPage(...(args as Parameters<typeof apiPage>));
    });

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
  });

  it('reloads once, however often Reload or Save is pressed', async () => {
    await mount();
    clientGraphql.savePassages.mockImplementation(async () => {
      addPassage('p1');
      return lostAnswer;
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
    const editP0 = observeSavedPassage();
    editP0();
    clientGraphql.savePassages.mockImplementation(async () => {
      editP0();
      return lostAnswer;
    });
    serverHolds('p0');
    await act(() => editorState.save());
    const asked = toasted().length;
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
    mockGraphqlRequest.mockImplementationOnce(async (...args) => {
      editP0();
      return apiPage(...(args as Parameters<typeof apiPage>));
    });

    await act(async () => press(lastToast()[1].action));

    expect(mounts).toBe(1);
    expect(toasted()).toHaveLength(asked + 1);
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
  });

  it('asks again when a stack edit while reloading changes no count', async () => {
    await mount();
    let revision = 0;
    registerStack({
      isDirty: () => true,
      unsavedChanges: () => 1,
      revision: () => revision,
    });
    clientGraphql.savePassages.mockResolvedValue(lostAnswer);
    serverHolds('p0');
    await act(() => editorState.save());
    const asked = toasted().length;
    mockGraphqlRequest.mockImplementationOnce(async (...args) => {
      revision += 1;
      return apiPage(...(args as Parameters<typeof apiPage>));
    });

    await act(async () => press(lastToast()[1].action));

    expect(mounts).toBe(1);
    expect(toasted()).toHaveLength(asked + 1);
  });

  it('keeps the warning up when Reload has to ask again', async () => {
    mockSonner.real = true;
    const sonner = jest.requireActual('@eightyfourthousand/design-system');
    designSystem.toast.mockImplementation(sonner.toast);
    await mount();
    clientGraphql.savePassages.mockImplementation(async () => {
      addPassage('p1');
      return lostAnswer;
    });
    serverHolds('p0');
    await act(() => editorState.save());
    await screen.findByText(/discard 1 unsaved change\./);
    addPassage('p2');

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    await screen.findByText(/discard 2 unsaved changes\./);
    // Past the time Sonner takes to remove a dismissed toast.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(screen.getByText(/discard 2 unsaved changes\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(mounts).toBe(1);
    act(() => sonner.toast.dismiss());
  });

  it('settles nothing once the session is gone', async () => {
    const view = await mount();
    clientGraphql.savePassages.mockImplementation(async () => {
      addPassage('p1');
      return lostAnswer;
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
    const unconfirmed: UnconfirmedSave = {
      sent: [],
      inserted: [],
      deleted: ['s1'],
      newerChanges: () => 0,
      restore: jest.fn(async () => undefined),
    };
    registerStack({ save: async () => ({ outcome: 'unknown', unconfirmed }) });
    await act(() => editorState.save());
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');

    await act(async () => press(lastToast()[1].action));

    await waitFor(() => expect(mounts).toBe(2));
  });

  it('asks before a reload discards a passage added during the save', async () => {
    await mount();
    clientGraphql.savePassages.mockImplementation(async () => {
      addPassage('p1');
      return lostAnswer;
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
    expect(clientGraphql.savePassages).toHaveBeenCalledTimes(1);
  });

  it('asks before a reload discards an edit to a passage it sent', async () => {
    await mount();
    const editP0 = observeSavedPassage();
    editP0();
    clientGraphql.savePassages.mockImplementation(async () => {
      editP0();
      return lostAnswer;
    });
    serverHolds('p0');

    await act(() => editorState.save());

    expect(sentUuids(0)).toEqual(['p0']);
    expect(mounts).toBe(1);
    const [title, { description }] = lastToast();
    expect(title).toBe('Your last save may have gone through.');
    expect(description).toContain('discard 1 unsaved change.');
  });

  it('asks before a reload discards the stack edits', async () => {
    await mount();
    registerStack({ isDirty: () => true, unsavedChanges: () => 2 });
    clientGraphql.savePassages.mockResolvedValue(lostAnswer);
    serverHolds('p0');

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(lastToast()[1].description).toContain('discard 2 unsaved changes.');
  });

  it('asks before a reload discards the paginated edits', async () => {
    await mount();
    const unconfirmed: UnconfirmedSave = {
      sent: ['s1'],
      inserted: ['s1'],
      deleted: [],
      newerChanges: () => 0,
      restore: jest.fn(async () => undefined),
    };
    registerStack({ save: async () => ({ outcome: 'unknown', unconfirmed }) });
    serverHolds('s1');

    await act(() => editorState.save());

    // The paginated half waits, so the edit there is not sent.
    expect(clientGraphql.savePassages).not.toHaveBeenCalled();
    expect(mounts).toBe(1);
    expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
  });

  describe('with a stack save that only changed content', () => {
    const replayable = (): UnconfirmedSave => ({
      sent: ['s1'],
      inserted: [],
      deleted: [],
      newerChanges: () => 0,
      restore: async () => undefined,
      replayable: true,
    });
    const registerReplayable = () =>
      registerStack({
        save: async () => ({ outcome: 'unknown', unconfirmed: replayable() }),
        isDirty: () => true,
        unsavedChanges: () => 1,
      });

    it('leaves it for the next save to send again', async () => {
      await mount();
      act(() => editorState.setEditor('main', undefined));
      registerReplayable();

      await act(() => editorState.save());

      expect(mounts).toBe(1);
      expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
      expect(toasted()).toEqual(['Your last save could not be confirmed.']);
      expect(editorState.dirtyStore.getSnapshot()).toBe(true);
    });

    it('shows that the paginated half failed', async () => {
      await mount();
      registerReplayable();
      clientGraphql.savePassages.mockResolvedValue({
        success: false,
        savedCount: 0,
        passages: [],
        renumberedPassages: [],
        error: 'nope',
      });

      await act(() => editorState.save());

      expect(toasted()).toEqual(['Error saving content.']);
      expect(editorState.dirtyStore.getSnapshot()).toBe(true);
    });

    // Its edits may not have been applied, so a reload would discard them.
    it('asks before a reload for the paginated half discards it', async () => {
      await mount();
      registerReplayable();
      clientGraphql.savePassages.mockResolvedValue(lostAnswer);
      serverHolds('p0');

      await act(() => editorState.save());

      expect(dataAccess.getPassageSorts).toHaveBeenCalledWith(
        expect.objectContaining({ uuids: ['p0'] }),
      );
      expect(mounts).toBe(1);
      expect(lastToast()[1].description).toContain('discard 1 unsaved change.');
    });
  });

  it('keeps the edits of a save the server refused', async () => {
    await mount();
    clientGraphql.savePassages.mockRejectedValue(
      clientError(400, [{ message: 'invalid input' }]),
    );

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(toasted()).toEqual(['Error saving content.']);
    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);
  });

  it('keeps the edits of a save that was never sent', async () => {
    await mount();
    clientGraphql.savePassages.mockRejectedValue(
      new clientGraphql.RequestNotSentError(new Error('session expired')),
    );

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(toasted()).toEqual(['Error saving content.']);
    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);
  });
});
