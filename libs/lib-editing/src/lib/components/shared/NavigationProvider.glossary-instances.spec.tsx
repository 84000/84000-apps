import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useGlossaryPassages } from './glossary/GlossaryPassagesDialog';
import { NavigationProvider } from './NavigationProvider';

// The editor's navigation provider turns the passages dialog's Instances tab
// on with `glossaryInstances`; the reader's leaves it off.

jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  lookup: jest.fn(async () => null),
  getPassage: jest.fn(),
  getTranslationImprint: jest.fn(async () => undefined),
  getGlossaryTermExcerpts: jest.fn(async () => ({
    items: [],
    totalCount: 0,
    hasMore: false,
    nextCursor: null,
  })),
  getGlossaryTermInstances: jest.fn(async () => ({
    items: [],
    totalCount: 0,
    offset: 0,
  })),
}));

const mockParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => mockParams,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/translation/w1',
}));
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

const Opener = () => {
  const passages = useGlossaryPassages();
  return (
    <button
      onClick={() =>
        passages?.openGlossaryPassages({ uuid: 'term-1', english: 'virtue' })
      }
    >
      open
    </button>
  );
};

const openDialog = async (props: { glossaryInstances?: boolean }) => {
  render(
    <NavigationProvider uuid="w1" initialToh="toh8" {...props}>
      <Opener />
    </NavigationProvider>,
  );
  await userEvent.click(screen.getByText('open'));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, '', '/');
});

describe('NavigationProvider glossaryInstances', () => {
  it('gives the passages dialog an Instances tab', async () => {
    const dialog = await openDialog({ glossaryInstances: true });

    expect(within(dialog).getByRole('tab', { name: 'Instances' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'Passages' })).toBeTruthy();
  });

  it('leaves it off without the prop, as the reader mounts it', async () => {
    const dialog = await openDialog({});

    expect(within(dialog).queryByRole('tab', { name: 'Instances' })).toBeNull();
  });
});
