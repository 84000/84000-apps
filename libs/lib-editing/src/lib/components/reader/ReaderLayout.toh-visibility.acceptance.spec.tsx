import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { tohHiddenSelector } from '../shared/hooks/useTohToggle';
import { ReaderLayout } from './ReaderLayout';

// Acceptance test for DEV-837 item 6a, AC6.7: `ReaderLayout` draws the
// `TohVisibilityStyle` rule for the navigation's Toh, including on the server.
//
// Approach: `ReaderLayout` is rendered for real, over the real
// `NavigationProvider`. Only its surroundings are stubbed (the panel chrome,
// the three-column renderer, the editor header, the network and Next).

// Importing the `shared` barrel reaches `data-access/ssr` through
// `redirects.ts`, hence `next/server` and `resend`. See
// `stack/PassageStackController.spec.ts`.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));
jest.mock('server-only', () => ({}));
jest.mock('next/og', () => ({ ImageResponse: class {} }));
jest.mock('next/navigation', () => ({
  notFound: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
}));

jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getTranslationImprint: jest.fn(async () => undefined),
  getTranslationMetadataByUuid: jest.fn(),
}));
jest.mock('@eightyfourthousand/lib-instr', () => ({
  ...jest.requireActual('@eightyfourthousand/lib-instr'),
  useFeatureFlagEnabled: () => false,
}));
jest.mock('@eightyfourthousand/lib-instr/static', () => ({
  isStaticFeatureEnabled: () => false,
}));

jest.mock('@eightyfourthousand/design-system', () => {
  const Slot = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    ...jest.requireActual('@eightyfourthousand/design-system'),
    LeftPanel: Slot,
    MainPanel: Slot,
    MainPanelHeader: Slot,
    RightPanel: Slot,
  };
});
jest.mock('../shared/ThreeColumnRenderer', () => ({
  ThreeColumnRenderer: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('../shared/HoverCardProvider', () => ({
  HoverCardProvider: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('../shared/RestrictionWarning', () => ({
  RestrictionWarning: () => null,
}));
jest.mock('../editor/EditorHeader', () => ({ EditorHeader: () => null }));

/** A `params` promise that `use` reads without suspending. */
const settled = <T,>(value: T) =>
  Object.assign(Promise.resolve(value), {
    status: 'fulfilled' as const,
    value,
  });

const layout = (initialToh?: 'toh145' | 'toh847') => (
  <ReaderLayout
    left={<div>left</div>}
    main={<div>main</div>}
    right={<div>right</div>}
    params={settled({ slug: 'w1' })}
    initialToh={initialToh}
  />
);

const styleText = (root: ParentNode) =>
  [...root.querySelectorAll('style')]
    .map((style) => style.textContent)
    .join('\n');

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  document.head.querySelectorAll('style').forEach((style) => style.remove());
});

describe('ReaderLayout Toh visibility (AC6.7)', () => {
  it('server-renders the visibility rule for initialToh', () => {
    const html = renderToString(layout('toh847'));

    expect(html).toContain(tohHiddenSelector('toh847'));
    expect(html).toMatch(/<style[^>]*>[^<]*display:\s*none/);
  });

  it("draws the rule for the navigation's Toh once the URL names another", () => {
    window.history.replaceState(null, '', '/?toh=toh145');

    const { container } = render(layout('toh847'));

    const css = styleText(document) + styleText(container);
    expect(css).toContain(tohHiddenSelector('toh145'));
    expect(css).not.toContain(tohHiddenSelector('toh847'));
  });
});
