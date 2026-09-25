import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationProvider, useNavigation } from './NavigationProvider';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getBibliographyEntry: jest.fn(),
  getGlossaryInstance: jest.fn(),
  lookup: jest.fn(async () => null),
  getPassage: jest.fn(),
  getTranslationImprint: jest.fn(async () => undefined),
  getTranslationMetadataByUuid: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
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

/**
 * The attributes the comment mark renders, which the delegated click handler
 * matches on. `type` and `comment` are not span props as far as TSX is
 * concerned, so they are spread rather than written inline.
 */
const anchorAttrs = (comment: string) =>
  ({ type: 'comment', comment }) as Record<string, string>;

/** Reports the bits of navigation state this suite is about. */
const Probe = () => {
  const { focusedComment, panels, updatePanel } = useNavigation();
  return (
    <div>
      <span data-testid="focused">{focusedComment ?? 'none'}</span>
      <span data-testid="left">
        {`${panels.left.open ? 'open' : 'closed'}:${panels.left.tab ?? '-'}`}
      </span>
      <button
        onClick={() =>
          updatePanel({ name: 'left', state: { open: false, tab: 'comments' } })
        }
      >
        Close the panel
      </button>
    </div>
  );
};

const renderProvider = (editable = true) =>
  render(
    <NavigationProvider uuid="w1" editable={editable}>
      <Probe />
      <span {...anchorAttrs('t1')}>commented text</span>
    </NavigationProvider>,
  );

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, '', '/');
});

describe('NavigationProvider comment anchors', () => {
  it('focuses a thread and opens the panel on it when its anchor is clicked', async () => {
    renderProvider();

    await userEvent.click(screen.getByText('commented text'));

    expect(screen.getByTestId('focused').textContent).toBe('t1');
    expect(screen.getByTestId('left').textContent).toBe('open:comments');
  });

  it('leaves a reader no panel to open', async () => {
    // The comments tab is the studio's; the mark still renders for a reader
    // reading draft content.
    renderProvider(false);

    await userEvent.click(screen.getByText('commented text'));

    expect(screen.getByTestId('focused').textContent).toBe('t1');
    expect(screen.getByTestId('left').textContent).not.toContain('comments');
  });

  it('drops the focused thread when the panel is closed', async () => {
    // The anchor in the text is lit from the focused thread, so leaving it set
    // would keep a mark lit with nothing on screen to say why.
    renderProvider();

    await userEvent.click(screen.getByText('commented text'));
    expect(screen.getByTestId('focused').textContent).toBe('t1');

    await userEvent.click(screen.getByText('Close the panel'));

    expect(screen.getByTestId('focused').textContent).toBe('none');
  });

  it('picks the innermost anchor where comment marks overlap', async () => {
    // Two editors commenting on overlapping spans is the ordinary case, and
    // the innermost is the most specific thread.
    render(
      <NavigationProvider uuid="w1" editable>
        <Probe />
        <span {...anchorAttrs('outer')}>
          <span {...anchorAttrs('inner')}>overlapping</span>
        </span>
      </NavigationProvider>,
    );

    await userEvent.click(screen.getByText('overlapping'));

    expect(screen.getByTestId('focused').textContent).toBe('inner');
  });

  it('ignores a click that is not on an anchor', async () => {
    renderProvider();

    await act(async () => {
      document.body.click();
    });

    expect(screen.getByTestId('focused').textContent).toBe('none');
  });
});

describe('NavigationProvider editor requests', () => {
  /** Hands the context out of the tree, so the test can call into it. */
  let navigation: ReturnType<typeof useNavigation> | undefined;
  const Capture = () => {
    navigation = useNavigation();
    return null;
  };

  const renderCapture = () =>
    render(
      <NavigationProvider uuid="w1" editable>
        <Capture />
      </NavigationProvider>,
    );

  // Each passage stack answers only for its own rows, so a second stack
  // registering must not take the first one's rows away.
  it('asks each registered host until one holds the element', async () => {
    renderCapture();
    const mine = document.createElement('div');
    const theirs = document.createElement('div');
    const editor = { id: 'editor' } as never;

    const unregisterOther = navigation!.registerEditorRequest((element) =>
      element === theirs ? Promise.resolve(null) : null,
    );
    navigation!.registerEditorRequest((element) =>
      element === mine ? Promise.resolve(editor) : null,
    );

    await expect(navigation!.requestEditorFor?.(mine)).resolves.toBe(editor);
    unregisterOther();
    await expect(navigation!.requestEditorFor?.(theirs)).resolves.toBeNull();
  });

  it('stops asking a host once it is removed', async () => {
    renderCapture();
    const element = document.createElement('div');
    const request = jest.fn(() => Promise.resolve(null));
    const unregister = navigation!.registerEditorRequest(request);
    unregister();

    await expect(navigation!.requestEditorFor?.(element)).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});
