import { useEffect } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TohokuCatalogEntry } from '@eightyfourthousand/data-access';
import { NavigationProvider, useNavigation } from './NavigationProvider';

// Acceptance tests for DEV-837 item 6a, section 1: `setDefaultToh` makes a Toh
// active unless one already is (AC6.1 to AC6.3).

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getBibliographyEntry: jest.fn(),
  getGlossaryInstance: jest.fn(),
  lookup: jest.fn(async () => null),
  getPassage: jest.fn(),
  getTranslationImprint: jest.fn(async () => undefined),
  getTranslationMetadataByUuid: jest.fn(),
}));

// Behaves like the App Router: a history write that changes the query yields
// new search params, and one that leaves it as it was yields the same object.
const mockSearch = {
  listeners: new Set<() => void>(),
  cached: { search: '', params: new URLSearchParams() },
  subscribe: (listener: () => void) => {
    mockSearch.listeners.add(listener);
    return () => mockSearch.listeners.delete(listener);
  },
  snapshot: () => {
    const { search } = window.location;
    if (search !== mockSearch.cached.search) {
      mockSearch.cached = { search, params: new URLSearchParams(search) };
    }
    return mockSearch.cached.params;
  },
};

jest.mock('next/navigation', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useSearchParams: () =>
      useSyncExternalStore(mockSearch.subscribe, mockSearch.snapshot),
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    }),
    usePathname: () => '/translation/w1',
  };
});

for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History['pushState']>) => {
    original(...args);
    mockSearch.listeners.forEach((listener) => listener());
  };
}

jest.mock('@eightyfourthousand/lib-instr', () => ({
  useFeatureFlagEnabled: () => false,
}));
jest.mock('@eightyfourthousand/lib-instr/static', () => ({
  isStaticFeatureEnabled: () => false,
}));
jest.mock('./HoverCardProvider', () => ({
  HoverCardProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('./RestrictionWarning', () => ({
  RestrictionWarning: () => null,
}));

/** Reports the active Toh and offers buttons that call `setDefaultToh`. */
const Probe = () => {
  const { toh, setDefaultToh } = useNavigation();
  return (
    <div>
      <span data-testid="toh">{toh ?? 'none'}</span>
      <button onClick={() => setDefaultToh('toh1')}>Default to toh1</button>
      <button onClick={() => setDefaultToh('toh2')}>Default to toh2</button>
    </div>
  );
};

/** A component rendered with no Toh yet, which offers a default as it mounts. */
const MountDefault = ({ toh }: { toh: TohokuCatalogEntry }) => {
  const { setDefaultToh } = useNavigation();
  useEffect(() => {
    setDefaultToh(toh);
  }, [setDefaultToh, toh]);
  return null;
};

const renderProvider = (initialToh?: TohokuCatalogEntry) =>
  render(
    <NavigationProvider uuid="w1" initialToh={initialToh}>
      <Probe />
    </NavigationProvider>,
  );

const activeToh = () => screen.getByTestId('toh').textContent;

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, '', '/');
});

describe('NavigationProvider setDefaultToh', () => {
  it('AC6.1: keeps the Toh in the URL when a component with no Toh yet offers a default as it mounts', async () => {
    window.history.replaceState(null, '', '/?toh=toh2');

    render(
      <NavigationProvider uuid="w1">
        <Probe />
        <MountDefault toh="toh1" />
      </NavigationProvider>,
    );

    expect(activeToh()).toBe('toh2');

    // Still toh2 once any later URL sync has settled.
    await act(async () => {
      await Promise.resolve();
    });
    expect(activeToh()).toBe('toh2');
  });

  it('AC6.3: starts on initialToh when the URL names none, and keeps it when a default is offered', async () => {
    renderProvider('toh1');

    expect(activeToh()).toBe('toh1');

    await userEvent.click(screen.getByText('Default to toh2'));

    expect(activeToh()).toBe('toh1');
  });
});
