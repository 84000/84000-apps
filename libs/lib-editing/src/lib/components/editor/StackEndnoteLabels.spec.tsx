import { act, fireEvent, render, screen } from '@testing-library/react';
import { createContext, type ReactNode } from 'react';
import type { Work } from '@eightyfourthousand/data-access';

import { EditorContextProvider } from './EditorProvider';
import { StackEndnoteLabels } from './StackEndnoteLabels';

// See EditorProvider.read-only.spec.tsx for why these are mocked.
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
jest.mock('../shared/RestrictionWarning', () => ({
  RestrictionWarning: () => null,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({ request: jest.fn() })),
  hasPermission: jest.fn(async () => true),
  savePassages: jest.fn(),
  getPassage: jest.fn(),
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
jest.mock('./extensions/useHoverCardEditor', () => ({
  useHoverCardEditor: () => jest.fn(),
}));

/** A stack context of its own, so the card sees only what it would. */
const mockStackContext = createContext<unknown>(null);
jest.mock('../stack/StackWorkProvider', () => ({
  useStackWork: () => jest.requireActual('react').useContext(mockStackContext),
}));

/**
 * As `HoverCardProvider` draws it: on hover, the card beside its children, so
 * outside the stack they hold.
 */
jest.mock('../shared/HoverCardProvider', () => ({
  HoverCardProvider: ({ children }: { children: ReactNode }) => {
    const { EndNoteLinkHoverContent: MockCard } = jest.requireActual(
      './extensions/EndNoteLink/EndNoteLinkHoverContent',
    );
    const [open, setOpen] = jest.requireActual('react').useState(false);
    return (
      <>
        {children}
        <button onClick={() => setOpen(true)}>hover</button>
        {open && (
          <MockCard
            uuid="link-1"
            endNote="note-1"
            requestEditor={jest.fn()}
            anchor={globalThis.document.createElement('span')}
            close={jest.fn()}
            setHoverCardEditing={jest.fn()}
            editable={false}
          />
        )}
      </>
    );
  },
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as { getPassage: jest.Mock };

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

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

/** A spine holding `labels`; `relabel` changes one and tells its observers. */
const spineWith = (labels: Record<string, string>) => {
  const listeners = new Set<() => void>();
  const spine = {
    meta: (uuid: string) => (labels[uuid] ? { label: labels[uuid] } : null),
    observe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const relabel = (uuid: string, label: string) => {
    labels[uuid] = label;
    listeners.forEach((listener) => listener());
  };
  return { spine, relabel };
};

/**
 * The editor as `EditorLayout` nests it, the stack inside the providers, with
 * the endnote link hovered.
 */
const renderEditor = async (spine: unknown) => {
  render(
    <EditorContextProvider work={work}>
      <mockStackContext.Provider value={{ work: { spine } }}>
        <StackEndnoteLabels />
      </mockStackContext.Provider>
    </EditorContextProvider>,
  );
  await act(async () => undefined);
  fireEvent.click(screen.getByText('hover'));
  await act(async () => undefined);
};

beforeEach(() => {
  clientGraphql.getPassage.mockReset();
});

describe('StackEndnoteLabels', () => {
  it('labels a hover card drawn outside the stack, unsaved notes included', async () => {
    const { spine } = spineWith({ 'note-1': '1.3' });

    await renderEditor(spine);

    expect(screen.getByText('1.3')).toBeTruthy();
    expect(clientGraphql.getPassage).not.toHaveBeenCalled();
  });

  it('relabels the card when the stack renumbers', async () => {
    const { spine, relabel } = spineWith({ 'note-1': '1.3' });
    await renderEditor(spine);

    act(() => relabel('note-1', '1.2'));

    expect(screen.getByText('1.2')).toBeTruthy();
    expect(screen.queryByText('1.3')).toBeNull();
  });
});
