import { act, render, waitFor } from '@testing-library/react';
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
  getTranslationBlocks: jest.fn(),
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
}));

jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  toast: jest.fn(),
  Toaster: () => null,
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  RequestNotSentError: new (cause: unknown) => Error;
  getTranslationBlocks: jest.Mock;
  savePassages: jest.Mock;
};
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getPassageSorts: jest.Mock;
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
  render(
    <EditorContextProvider work={work}>
      <Capture />
    </EditorContextProvider>,
  );
  await waitFor(() => expect(mounts).toBe(1));
  act(() => editorState.setEditor('main', editorWithAnEdit()));
};

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

/** What the server holds after a save whose answer was lost. */
const serverHolds = (...uuids: string[]) =>
  dataAccess.getPassageSorts.mockImplementation(
    async ({ uuids: asked }: { uuids: string[] }) =>
      new Map(asked.filter((u) => uuids.includes(u)).map((u) => [u, 1])),
  );

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
    designSystem.toast.mockReset();
    clientGraphql.savePassages.mockReset();
    dataAccess.getPassageSorts.mockReset();
    mockGraphqlRequest.mockReset();
    clientGraphql.getTranslationBlocks.mockReset();
    clientGraphql.getTranslationBlocks.mockResolvedValue({
      blocks: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
    });
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
    clientGraphql.getTranslationBlocks.mockResolvedValueOnce({
      blocks: [],
      hasMoreAfter: false,
      hasMoreBefore: false,
      failed: true,
    });

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(editorState.getEditor('main')?.getText().trim()).toBe('edited');
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(clientGraphql.savePassages).toHaveBeenCalledTimes(1);
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

    await act(async () => action.onClick());
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
