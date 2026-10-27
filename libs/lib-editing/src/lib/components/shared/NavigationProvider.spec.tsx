import { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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

// Behaves like the App Router: a history write that changes the query yields
// new search params, and one that leaves it as it was yields the same object,
// so the provider sees its own URL writes come back the way it does in Next.
const mockSearch = {
  listeners: new Set<() => void>(),
  cached: { search: '', params: new URLSearchParams() },
  /** Held back in place of the URL, as a transition the router has not committed yet. */
  lagging: undefined as URLSearchParams | undefined,
  /** Throws on read, as Next does while prerendering a static page. */
  prerendering: false,
  subscribe: (listener: () => void) => {
    mockSearch.listeners.add(listener);
    return () => mockSearch.listeners.delete(listener);
  },
  snapshot: () => {
    if (mockSearch.lagging) return mockSearch.lagging;
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
    useSearchParams: () => {
      if (mockSearch.prerendering) {
        throw new Error('BAILOUT_TO_CLIENT_SIDE_RENDERING');
      }
      return useSyncExternalStore(mockSearch.subscribe, mockSearch.snapshot);
    },
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
  type Navigation = ReturnType<typeof useNavigation>;

  /** Hands the context out of the tree, so the test can call into it. */
  const Capture = ({ onValue }: { onValue: (value: Navigation) => void }) => {
    onValue(useNavigation());
    return null;
  };

  const renderCapture = (): Navigation => {
    const captured: { value?: Navigation } = {};
    render(
      <NavigationProvider uuid="w1" editable>
        <Capture onValue={(value) => (captured.value = value)} />
      </NavigationProvider>,
    );
    if (!captured.value) throw new Error('navigation was not rendered');
    return captured.value;
  };

  // Each passage stack answers only for its own rows, so a second stack
  // registering must not take the first one's rows away.
  it('asks each registered host until one holds the element', async () => {
    const navigation = renderCapture();
    const mine = document.createElement('div');
    const theirs = document.createElement('div');
    const editor = { id: 'editor' } as never;

    const unregisterOther = navigation.registerEditorRequest((element) =>
      element === theirs ? Promise.resolve(null) : null,
    );
    navigation.registerEditorRequest((element) =>
      element === mine ? Promise.resolve(editor) : null,
    );

    await expect(navigation.requestEditorFor?.(mine)).resolves.toBe(editor);
    unregisterOther();
    await expect(navigation.requestEditorFor?.(theirs)).resolves.toBeNull();
  });

  it('stops asking a host once it is removed', async () => {
    const navigation = renderCapture();
    const element = document.createElement('div');
    const request = jest.fn(() => Promise.resolve(null));
    const unregister = navigation.registerEditorRequest(request);
    unregister();

    await expect(navigation.requestEditorFor?.(element)).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('NavigationProvider xmlId deep links', () => {
  const graphql = jest.requireMock('@eightyfourthousand/client-graphql') as {
    lookup: jest.Mock;
    getPassage: jest.Mock;
  };

  /** Reports where each panel points. */
  const PanelsProbe = () => {
    const { panels } = useNavigation();
    return (
      <>
        {(['main', 'right'] as const).map((name) => (
          <span key={name} data-testid={name}>
            {`${panels[name].open ? 'open' : 'closed'}:${panels[name].tab ?? '-'}:${panels[name].hash ?? '-'}`}
          </span>
        ))}
      </>
    );
  };

  afterEach(() => {
    graphql.lookup.mockReset().mockResolvedValue(null);
    graphql.getPassage.mockReset();
  });

  // A section's heading row is typed `<section>Header`, and it lives in the
  // same tab as the section body, not in the translation fallback.
  it.each([
    ['introductionHeader', 'main', 'front'],
    ['abbreviationsHeader', 'right', 'abbreviations'],
  ])('opens a %s passage in %s/%s', async (type, panel, tab) => {
    graphql.lookup.mockResolvedValue({ type: 'passage', uuid: 'p-1' });
    graphql.getPassage.mockResolvedValue({ uuid: 'p-1', type });
    window.history.replaceState(null, '', '/#UT22084-001-001-12');

    render(
      <NavigationProvider uuid="w1" editable>
        <PanelsProbe />
      </NavigationProvider>,
    );

    const target = await screen.findByText(`open:${tab}:p-1`);
    expect(target.getAttribute('data-testid')).toBe(panel);
  });
});

describe('NavigationProvider URL sync', () => {
  /** Reports where the right panel points. */
  const RightProbe = () => {
    const { panels, updatePanel } = useNavigation();
    const { open, tab, hash } = panels.right;
    return (
      <>
        <span data-testid="right">
          {`${open ? 'open' : 'closed'}:${tab ?? '-'}:${hash ?? '-'}`}
        </span>
        <button
          onClick={() =>
            updatePanel({ name: 'left', state: { open: false, tab: 'toc' } })
          }
        >
          Close the contents
        </button>
      </>
    );
  };

  /** What a same-work link does: push the panel it opens onto the query. */
  const followLink = (hash: string) =>
    act(() => {
      const query = new URLSearchParams(window.location.search);
      query.set('right', `open:glossary:${hash}`);
      window.history.pushState({}, '', `?${query.toString()}`);
    });

  const renderProbe = () =>
    render(
      <NavigationProvider uuid="w1">
        <RightProbe />
      </NavigationProvider>,
    );

  // The provider writes the panels into the query on load. That write coming
  // back must not swallow the reader's first link.
  it('opens the panel for the first link followed after load', () => {
    renderProbe();

    followLink('g1');

    expect(screen.getByTestId('right').textContent).toBe('open:glossary:g1');
  });

  it('opens the panel for a link followed after a panel change', async () => {
    renderProbe();

    await userEvent.click(screen.getByText('Close the contents'));
    followLink('g1');

    expect(screen.getByTestId('right').textContent).toBe('open:glossary:g1');
  });

  // The router hands over its query in a transition, which can commit after
  // the URL has moved on. That query is stale and must not undo the move.
  it('ignores a query the URL has already moved past', async () => {
    renderProbe();
    followLink('g1');
    const stale = new URLSearchParams(window.location.search);

    await userEvent.click(screen.getByText('Close the contents'));
    act(() => {
      const query = new URLSearchParams(window.location.search);
      query.set('right', 'closed:glossary');
      window.history.pushState({}, '', `?${query.toString()}`);
    });
    expect(screen.getByTestId('right').textContent).toBe('closed:glossary:-');

    act(() => {
      mockSearch.lagging = stale;
      mockSearch.listeners.forEach((listener) => listener());
    });
    mockSearch.lagging = undefined;

    expect(screen.getByTestId('right').textContent).toBe('closed:glossary:-');
  });

  it('keeps a panel change rather than reading back the query it replaced', async () => {
    renderProbe();
    followLink('g1');

    await userEvent.click(screen.getByText('Close the contents'));

    expect(screen.getByTestId('right').textContent).toBe('open:glossary:g1');
    expect(new URLSearchParams(window.location.search).get('left')).toBe(
      'closed:toc',
    );
  });
});

describe('NavigationProvider static rendering', () => {
  afterEach(() => {
    mockSearch.prerendering = false;
  });

  // A prerendered page cannot read the query. Only the query's own boundary
  // may fall back to the client, or the reader ships as an empty shell.
  it('server-renders its children when the query cannot be read', () => {
    mockSearch.prerendering = true;

    const html = renderToString(
      <NavigationProvider uuid="w1">
        <p>Thus did I hear at one time.</p>
      </NavigationProvider>,
    );

    expect(html).toContain('Thus did I hear at one time.');
  });

  it('applies the panels in the URL at load rather than writing defaults over them', () => {
    window.history.replaceState(
      null,
      '',
      '/?left=closed:toc&right=open:glossary:g9',
    );

    render(
      <NavigationProvider uuid="w1">
        <Probe />
      </NavigationProvider>,
    );

    expect(screen.getByTestId('left').textContent).toBe('closed:toc');
    const query = new URLSearchParams(window.location.search);
    expect(query.get('left')).toBe('closed:toc');
    expect(query.get('right')).toBe('open:glossary:g9');
  });

  // The left panel and the passage stack fall back to the work's first toh on
  // mount. That default must not win over the toh the link asked for.
  it('keeps the toh in the URL over a default a child sets on mount', () => {
    const DefaultToh = () => {
      const { toh, setToh } = useNavigation();
      useEffect(() => {
        setToh(toh || 'toh1');
      }, [toh, setToh]);
      return <span data-testid="toh">{toh}</span>;
    };
    window.history.replaceState(null, '', '/?toh=toh2');

    render(
      <NavigationProvider uuid="w1" initialToh="toh1">
        <DefaultToh />
      </NavigationProvider>,
    );

    expect(screen.getByTestId('toh').textContent).toBe('toh2');
    expect(new URLSearchParams(window.location.search).get('toh')).toBe('toh2');
  });

  it('closes a right panel the URL opens when there is no translation', () => {
    window.history.replaceState(null, '', '/?right=open:glossary');

    render(
      <NavigationProvider uuid="w1" initialHasTranslationContent={false}>
        <Probe />
      </NavigationProvider>,
    );

    expect(new URLSearchParams(window.location.search).get('right')).toBe(
      'closed:glossary',
    );
  });
});
