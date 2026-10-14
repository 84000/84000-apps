import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { Work } from '@eightyfourthousand/data-access';

import {
  EditorContextProvider,
  useEditorState,
} from '../editor/EditorProvider';
import type { EditorContextState } from '../editor/editor-context';
import {
  StackWorkProvider,
  useStackWork,
  type StackWork,
} from './StackWorkProvider';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
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
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
  getTranslationBlocksAround: jest.fn(),
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
  savePassagesWithDeletions: jest.fn(),
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
  getPassageMetaPage: jest.Mock;
};
const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  BODY_MATTER_FILTER: string;
  savePassagesWithDeletions: jest.Mock;
  getPassageSorts: jest.Mock;
};
const designSystem = jest.requireMock('@eightyfourthousand/design-system') as {
  toast: jest.Mock;
};

type Row = { uuid: string; label: string; sort: number };

/** What the server holds: one body section, read in sort order. */
let server: Row[] = [];

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

let editor: EditorContextState;
let stack: StackWork | null = null;

const Capture = () => {
  const state = useEditorState();
  const held = useStackWork();
  useEffect(() => {
    editor = state;
    stack = held;
  });
  return held ? <span data-testid="seeded" /> : null;
};

/** The held spine, as `label@sort`; a passage not yet saved has no sort. */
const spine = () =>
  stack?.work.spine
    .entries()
    .map((entry) => `${entry.label}@${entry.sort ?? 'new'}`)
    .join(' ');

const para = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const mount = async () => {
  render(
    <EditorContextProvider work={work}>
      <StackWorkProvider workUuid="w1">
        <Capture />
      </StackWorkProvider>
    </EditorContextProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('seeded')).toBeTruthy());
};

/** Split the first passage, which inserts one and renumbers the rest. */
const splitFirst = () => {
  const held = stack?.work;
  if (!held) throw new Error('not seeded');
  server.forEach(({ uuid }) => {
    held.store.create(uuid, [para(`text of ${uuid}`)]);
    held.store.peek(uuid)?.markSynced();
  });
  const created = held.split('p0', 5)?.uuid;
  if (!created) throw new Error('no split');
  return created;
};

/**
 * The save commits, renumbering as the server plans, and then its answer is
 * lost. The server's labels differ from the client's guess, as they do when
 * the series runs on past what the editor holds.
 */
const commitThenLoseTheAnswer = () =>
  dataAccess.savePassagesWithDeletions.mockImplementation(
    async ({ passages }: { passages: { uuid: string }[] }) => {
      const created = passages.find(
        (p) => !server.some((r) => r.uuid === p.uuid),
      );
      server = [
        { uuid: 'p0', label: '1.1', sort: 0 },
        { uuid: created?.uuid ?? '', label: '1.2', sort: 1 },
        { uuid: 'p1', label: '1.3', sort: 2 },
        { uuid: 'p2', label: '1.40', sort: 3 },
      ];
      return {
        success: false,
        savedCount: 0,
        passages: [],
        renumberedPassages: [],
        error: 'The save may have been applied: fetch failed',
        outcomeUnknown: true,
      };
    },
  );

describe('a stack save whose answer was lost', () => {
  beforeAll(() => {
    // jsdom has none; the navigation provider asks whether this is mobile.
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  beforeEach(() => {
    server = [
      { uuid: 'p0', label: '1.1', sort: 0 },
      { uuid: 'p1', label: '1.2', sort: 1 },
      { uuid: 'p2', label: '1.3', sort: 2 },
    ];
    stack = null;
    designSystem.toast.mockReset();
    dataAccess.savePassagesWithDeletions.mockReset();
    dataAccess.getPassageSorts.mockReset();
    mockGraphqlRequest.mockReset();
    mockGraphqlRequest.mockResolvedValue({ __typename: 'Query' });
    clientGraphql.getPassageMetaPage.mockReset();
    clientGraphql.getPassageMetaPage.mockImplementation(
      async ({ type }: { type?: string }) => ({
        metas:
          type === dataAccess.BODY_MATTER_FILTER
            ? server.map((row) => ({ ...row, type: 'translation' }))
            : [],
        hasMoreAfter: false,
        hasMoreBefore: false,
      }),
    );
  });

  it('ends with what the server holds, not a replay of the save', async () => {
    await mount();
    splitFirst();
    commitThenLoseTheAnswer();
    dataAccess.getPassageSorts.mockResolvedValue(new Map());

    await act(() => editor.save());

    // The editor was read again: the server's labels and stored sorts.
    await waitFor(() => expect(spine()).toBe('1.1@0 1.2@1 1.3@2 1.40@3'));
    expect(designSystem.toast).toHaveBeenCalledWith(
      'Your last save may have gone through.',
      expect.anything(),
    );
    // Nothing is left to send, so the next save sends nothing.
    expect(stack?.work.store.dirty()).toEqual([]);
    await act(() => editor.save());
    expect(dataAccess.savePassagesWithDeletions).toHaveBeenCalledTimes(1);
  });

  it('read back the passages it sent before replacing the editor', async () => {
    await mount();
    const created = splitFirst();
    commitThenLoseTheAnswer();
    dataAccess.getPassageSorts.mockResolvedValue(new Map());

    await act(() => editor.save());

    const [{ uuids }] = dataAccess.getPassageSorts.mock.calls[0];
    expect([...uuids].sort()).toEqual(['p0', created].sort());
  });

  // Replacing the editor while the server cannot be read would show nothing,
  // and saving again would resend what may already be stored.
  it('pauses saving while the server cannot be read', async () => {
    await mount();
    splitFirst();
    commitThenLoseTheAnswer();
    dataAccess.getPassageSorts.mockResolvedValueOnce(null);

    await act(() => editor.save());

    expect(spine()).toContain('@new');
    expect(editor.dirtyStore.getSnapshot()).toBe(true);

    dataAccess.getPassageSorts.mockResolvedValueOnce(new Map());
    await act(() => editor.save());

    await waitFor(() => expect(spine()).toBe('1.1@0 1.2@1 1.3@2 1.40@3'));
    expect(dataAccess.savePassagesWithDeletions).toHaveBeenCalledTimes(1);
  });

  it('treats a save that threw as one that may have been applied', async () => {
    await mount();
    splitFirst();
    dataAccess.savePassagesWithDeletions.mockImplementation(async () => {
      server = [
        { uuid: 'p0', label: '1.1', sort: 0 },
        { uuid: 'p1', label: '1.3', sort: 2 },
        { uuid: 'p2', label: '1.40', sort: 3 },
      ];
      throw new Error('lost after the commit');
    });
    dataAccess.getPassageSorts.mockResolvedValue(new Map());

    await act(() => editor.save());

    await waitFor(() => expect(spine()).toBe('1.1@0 1.3@2 1.40@3'));
    await act(() => editor.save());
    expect(dataAccess.savePassagesWithDeletions).toHaveBeenCalledTimes(1);
  });
});
