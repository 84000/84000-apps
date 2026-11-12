import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useGlossaryPassages } from './glossary/GlossaryPassagesDialog';
import { NavigationProvider } from './NavigationProvider';

// Acceptance tests for DEV-912 criterion 1: the navigation provider the editor
// mounts turns the Instances tab on (`glossaryInstances`); the reader's does not.

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

describe('DEV-912 criterion 1: the editor turns the Instances tab on', () => {
  it('criterion 1: a provider with glossaryInstances gives the dialog an Instances tab', async () => {
    const dialog = await openDialog({ glossaryInstances: true });

    expect(within(dialog).getByRole('tab', { name: 'Instances' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'Passages' })).toBeTruthy();
  });

  it('criterion 1: a provider without it, as the reader mounts it, gives the dialog no Instances tab', async () => {
    const dialog = await openDialog({});

    expect(within(dialog).queryByRole('tab', { name: 'Instances' })).toBeNull();
  });
});
