import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { ClientError } from 'graphql-request';
import { XmlElement } from 'yjs';
import type { Work } from '@eightyfourthousand/data-access';

import { EditorContextProvider, useEditorState } from './EditorProvider';
import type { EditorContextState } from './editor-context';
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
  createGraphQLClient: jest.fn(() => ({ request: mockGraphqlRequest })),
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

/** A paginated editor holding one passage the last save has not seen. */
const editorWithAnEdit = () =>
  new Editor({
    element: document.createElement('div'),
    extensions,
    content: {
      type: 'translation',
      content: [
        {
          type: 'passage',
          attrs: { uuid: 'p0', label: '1.1', sort: 1, type: 'translation' },
          content: [
            {
              type: 'paragraph',
              attrs: { uuid: 'para-0' },
              content: [{ type: 'text', text: 'edited' }],
            },
          ],
        },
      ],
    },
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

const toasted = () => designSystem.toast.mock.calls.map(([title]) => title);

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
    mockGraphqlRequest.mockResolvedValue({ __typename: 'Query' });
    dataAccess.getPassageSorts.mockResolvedValue(new Map());
  });

  // A load refreshes the baseline too, so it cannot show the passage is stored.
  it('reads the editors again even when the passage is in the baseline', async () => {
    await mount();
    act(() => editorState.startObserving('main'));
    const fragment = editorState.getFragment('main');
    const passage = new XmlElement('passage');
    fragment.doc?.transact(() => fragment.insert(0, [passage]));
    passage.setAttribute('uuid', 'p0');
    fragment.doc?.transact(() => passage.setAttribute('label', '1.1'));
    act(() => editorState.refreshEditorBaseline('main'));
    clientGraphql.savePassages.mockRejectedValue(new TypeError('fetch failed'));

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(clientGraphql.savePassages).toHaveBeenCalledTimes(1);
  });

  it('sends a content-only stack save again', async () => {
    await mount();
    act(() => editorState.setEditor('main', undefined));
    const save = jest.fn(async () => ({
      outcome: 'unknown' as const,
      affected: ['s1'],
      replayable: true,
    }));
    act(() => editorState.registerSaveHandler({ save, isDirty: () => true }));

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(dataAccess.getPassageSorts).not.toHaveBeenCalled();
    expect(toasted()).toEqual(['Your last save could not be confirmed.']);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);
  });

  it('reads the editors again when the other half cannot be replayed', async () => {
    await mount();
    const save = jest.fn(async () => ({
      outcome: 'unknown' as const,
      affected: ['s1'],
      replayable: true,
    }));
    act(() => editorState.registerSaveHandler({ save, isDirty: () => true }));
    clientGraphql.savePassages.mockRejectedValue(new TypeError('fetch failed'));

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(dataAccess.getPassageSorts).toHaveBeenCalledWith(
      expect.objectContaining({ uuids: ['s1', 'p0'] }),
    );
  });

  it('reads the editors again when the server lost the answer', async () => {
    await mount();
    clientGraphql.savePassages.mockResolvedValue({
      success: false,
      savedCount: 0,
      passages: [],
      renumberedPassages: [],
      error: 'The save may have been applied: fetch failed',
      outcomeUnknown: true,
    });

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(dataAccess.getPassageSorts).toHaveBeenCalledWith(
      expect.objectContaining({ uuids: ['p0'] }),
    );
    expect(toasted()).toEqual(['Your last save may have gone through.']);
    // A fresh session: nothing left over to resend.
    expect(editorState.dirtyStore.getSnapshot()).toBe(false);
  });

  it('reads the editors again when no answer arrived', async () => {
    await mount();
    clientGraphql.savePassages.mockRejectedValue(new TypeError('fetch failed'));

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    expect(toasted()).toEqual(['Your last save may have gone through.']);
  });

  it('pauses saving until the server can be read', async () => {
    await mount();
    clientGraphql.savePassages.mockRejectedValue(new TypeError('fetch failed'));
    mockGraphqlRequest.mockRejectedValueOnce(new TypeError('fetch failed'));

    await act(() => editorState.save());

    expect(mounts).toBe(1);
    expect(editorState.dirtyStore.getSnapshot()).toBe(true);

    await act(() => editorState.save());

    await waitFor(() => expect(mounts).toBe(2));
    // The save is never sent again, only read back.
    expect(clientGraphql.savePassages).toHaveBeenCalledTimes(1);
    expect(dataAccess.getPassageSorts).toHaveBeenCalledTimes(2);
  });

  it('sends nothing while offline', async () => {
    await mount();
    const onLine = jest.spyOn(navigator, 'onLine', 'get');
    onLine.mockReturnValue(false);
    try {
      await act(() => editorState.save());
    } finally {
      onLine.mockRestore();
    }

    expect(clientGraphql.savePassages).not.toHaveBeenCalled();
    expect(toasted()).toEqual(['You are offline.']);
    expect(mounts).toBe(1);
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

  it('shows the warnings of a save that succeeded', async () => {
    await mount();
    clientGraphql.savePassages.mockResolvedValue({
      success: true,
      savedCount: 1,
      passages: [],
      renumberedPassages: [],
      warnings: ['one', 'two', 'three', 'four'],
    });

    await act(() => editorState.save());

    expect(designSystem.toast).toHaveBeenCalledWith(
      'Content saved, with warnings',
      expect.objectContaining({ description: 'one\ntwo\nthree\nand 1 more' }),
    );
  });
});
