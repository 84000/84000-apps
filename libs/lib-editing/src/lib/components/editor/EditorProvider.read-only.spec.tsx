import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import type { Work } from '@eightyfourthousand/data-access';

import { EditorContextProvider, useEditorState } from './EditorProvider';
import type { EditorContextState, SaveHandler } from './editor-context';
import { EditorSettingsMenu } from './EditorSettingsMenu';
import { EditorHeader } from './EditorHeader';
import { READ_ONLY_STORAGE_KEY } from './read-only-preference';
import { useNavigation } from '../shared/NavigationProvider';

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
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({ request: jest.fn() })),
  hasPermission: jest.fn(),
  savePassages: jest.fn(),
  getTranslationImprint: jest.fn(async () => undefined),
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
}));
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  toast: jest.fn(),
  Toaster: () => null,
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as { hasPermission: jest.Mock };

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

let state: EditorContextState;
let editable: boolean;

const Capture = () => {
  const editor = useEditorState();
  const navigation = useNavigation();
  useEffect(() => {
    state = editor;
    editable = navigation.editable;
  });
  return null;
};

/** Let the permission check answer. */
const settle = () => act(async () => undefined);

const renderEditor = async () => {
  render(
    <EditorContextProvider work={work}>
      <EditorHeader />
      <EditorSettingsMenu />
      <Capture />
    </EditorContextProvider>,
  );
  await settle();
};

const openMenu = () => {
  // Radix opens on pointerdown or a key, and jsdom has no pointer events.
  fireEvent.keyDown(screen.getByRole('button', { name: 'Editor settings' }), {
    key: 'Enter',
  });
};

// jsdom has no matchMedia, which the provider's mobile check reads.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

beforeEach(() => {
  localStorage.clear();
  clientGraphql.hasPermission.mockReset().mockResolvedValue(true);
});

describe('read-only editor', () => {
  it('is read-only until the permission check answers', () => {
    clientGraphql.hasPermission.mockReturnValue(new Promise(() => undefined));
    render(
      <EditorContextProvider work={work}>
        <Capture />
      </EditorContextProvider>,
    );

    expect(state.readOnly).toBe(true);
    expect(editable).toBe(false);
  });

  it('is editable for a user who may edit', async () => {
    await renderEditor();

    expect(state.editPermitted).toBe(true);
    expect(state.readOnly).toBe(false);
    expect(editable).toBe(true);
    expect(screen.queryByText('Read-only')).toBeNull();
  });

  it('is read-only, with no settings, for a user who may not edit', async () => {
    clientGraphql.hasPermission.mockResolvedValue(false);
    await renderEditor();

    expect(state.readOnly).toBe(true);
    expect(editable).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Editor settings' }),
    ).toBeNull();
    expect(screen.getByText('Read-only')).toBeTruthy();
  });

  it('reads a failed permission check as read-only', async () => {
    clientGraphql.hasPermission.mockRejectedValue(new Error('offline'));
    await renderEditor();

    expect(state.readOnly).toBe(true);
  });

  it('turns read-only on and off from the settings menu', async () => {
    await renderEditor();

    openMenu();
    const item = await screen.findByRole('menuitemcheckbox', {
      name: 'Read-only',
    });
    expect(item.getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      fireEvent.click(item);
    });
    expect(state.readOnly).toBe(true);
    expect(editable).toBe(false);
    expect(localStorage.getItem(READ_ONLY_STORAGE_KEY)).toBe('true');
    // The menu stays open, showing the new state.
    expect(item.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      fireEvent.click(item);
    });
    expect(state.readOnly).toBe(false);
    expect(localStorage.getItem(READ_ONLY_STORAGE_KEY)).toBeNull();
  });

  it('remembers the choice', async () => {
    localStorage.setItem(READ_ONLY_STORAGE_KEY, 'true');
    await renderEditor();

    expect(state.readOnlyChosen).toBe(true);
    expect(state.readOnly).toBe(true);
    expect(screen.getAllByText('Read-only').length).toBeGreaterThan(0);
  });

  it('opens editable when storage cannot be read', async () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    try {
      await renderEditor();
      expect(state.readOnly).toBe(false);
    } finally {
      getItem.mockRestore();
    }
  });

  it('saves pending changes before turning read-only', async () => {
    await renderEditor();
    const order: string[] = [];
    const handler: SaveHandler = {
      save: jest.fn(async () => {
        order.push(`save while readOnly=${state.readOnly}`);
        return { outcome: 'saved' as const };
      }),
      isDirty: () => true,
      unsavedChanges: () => 1,
    } as unknown as SaveHandler;
    act(() => {
      state.registerSaveHandler(handler);
      state.dirtyStore.setDirty(true);
    });

    await act(async () => {
      await state.setReadOnlyChosen(true);
    });

    expect(handler.save).toHaveBeenCalled();
    expect(order).toEqual(['save while readOnly=false']);
    expect(state.readOnly).toBe(true);
  });

  it('does not save when turning read-only off', async () => {
    localStorage.setItem(READ_ONLY_STORAGE_KEY, 'true');
    await renderEditor();
    const save = jest.fn(async () => ({ outcome: 'saved' as const }));
    act(() => {
      state.registerSaveHandler({
        save,
        isDirty: () => true,
        unsavedChanges: () => 1,
      } as unknown as SaveHandler);
      state.dirtyStore.setDirty(true);
    });

    await act(async () => {
      await state.setReadOnlyChosen(false);
    });

    expect(save).not.toHaveBeenCalled();
    expect(state.readOnly).toBe(false);
  });
});
