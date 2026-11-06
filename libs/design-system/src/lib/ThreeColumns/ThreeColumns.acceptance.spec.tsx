/**
 * Acceptance tests for DEV-893: ThreeColumns mounts its main panel, header,
 * toolbar and actions exactly once at every viewport width, and renders each
 * side panel in exactly one place (a Sheet on mobile, a resizable panel on
 * desktop). Written from the spec alone.
 *
 * The viewport is driven through `window.innerWidth` plus a stubbed
 * `matchMedia` that these tests fire `change` on, so the real `useIsMobile`
 * runs.
 */
import { useEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  LeftPanel,
  MainPanel,
  MainPanelHeader,
  RightPanel,
  ThreeColumns,
} from './ThreeColumns';

const PHONE = 390;
const TABLET = 768; // first desktop width: mobile is innerWidth < 768
const DESKTOP = 1280;

// --- viewport / jsdom polyfills -------------------------------------------

type ChangeListener = (event: unknown) => void;
const mediaListeners = new Set<ChangeListener>();

const setViewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
};

/** Resize the window and tell every matchMedia subscriber, as a browser does. */
const resizeTo = (width: number) => {
  setViewport(width);
  act(() => {
    [...mediaListeners].forEach((listener) =>
      listener({ type: 'change', matches: width < 768 }),
    );
  });
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        return window.innerWidth < 768;
      },
      onchange: null,
      addEventListener: (type: string, listener: ChangeListener) => {
        if (type === 'change') mediaListeners.add(listener);
      },
      removeEventListener: (type: string, listener: ChangeListener) => {
        if (type === 'change') mediaListeners.delete(listener);
      },
      addListener: (listener: ChangeListener) => mediaListeners.add(listener),
      removeListener: (listener: ChangeListener) =>
        mediaListeners.delete(listener),
      dispatchEvent: () => true,
    }),
  });

  class ResizeObserverStub {
    observe() {
      /* noop */
    }
    unobserve() {
      /* noop */
    }
    disconnect() {
      /* noop */
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver =
    ResizeObserverStub;

  // Radix touches these in jsdom
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.scrollIntoView = proto.scrollIntoView ?? (() => undefined);
  proto.hasPointerCapture = proto.hasPointerCapture ?? (() => false);
  proto.setPointerCapture = proto.setPointerCapture ?? (() => undefined);
  proto.releasePointerCapture =
    proto.releasePointerCapture ?? (() => undefined);
});

beforeEach(() => {
  mediaListeners.clear();
  mounts.length = 0;
  unmounts.length = 0;
});

// --- probes ----------------------------------------------------------------

/** Mount / unmount log of the probe inside the main panel. */
const mounts: string[] = [];
const unmounts: string[] = [];

/** Counts its own mounts and unmounts, and holds a counter in state. */
const MountProbe = ({ name }: { name: string }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    mounts.push(name);
    return () => {
      unmounts.push(name);
    };
  }, [name]);
  return (
    <div data-testid={`${name}-probe`}>
      <span data-testid={`${name}-count`}>{count}</span>
      <button
        type="button"
        data-testid={`${name}-increment`}
        onClick={() => setCount((c) => c + 1)}
      >
        increment {name}
      </button>
    </div>
  );
};

const count = (testId: string) => screen.queryAllByTestId(testId).length;

const toggleCount = (label: 'Toggle Left Panel' | 'Toggle Right Panel') =>
  screen.queryAllByText(label).length;

interface HarnessProps {
  leftPanelOpen?: boolean;
  rightPanelOpen?: boolean;
  rightPanelEnabled?: boolean;
  onLeftPanelOpenChange?: (open: boolean) => void;
  onRightPanelOpenChange?: (open: boolean) => void;
}

const Layout = (props: HarnessProps) => (
  <ThreeColumns mainPanelActions={<MountProbe name="actions" />} {...props}>
    <MainPanelHeader>
      <div data-testid="header-content">Header</div>
    </MainPanelHeader>
    <LeftPanel>
      <div data-testid="left-content">Left</div>
    </LeftPanel>
    <MainPanel>
      <div data-testid="main-content">Main</div>
      <MountProbe name="main" />
    </MainPanel>
    <RightPanel>
      <div data-testid="right-content">Right</div>
    </RightPanel>
  </ThreeColumns>
);

/** Controlled wrapper: the open state follows the change callbacks. */
const StatefulLayout = ({
  initialLeft = false,
  initialRight = false,
  onLeft,
  onRight,
}: {
  initialLeft?: boolean;
  initialRight?: boolean;
  onLeft?: (open: boolean) => void;
  onRight?: (open: boolean) => void;
}) => {
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);
  return (
    <Layout
      leftPanelOpen={left}
      rightPanelOpen={right}
      onLeftPanelOpenChange={(open) => {
        onLeft?.(open);
        setLeft(open);
      }}
      onRightPanelOpenChange={(open) => {
        onRight?.(open);
        setRight(open);
      }}
    />
  );
};

/**
 * Click every toggle with this label. Single-chrome is asserted elsewhere; here
 * only the callback behaviour is under test.
 */
const clickAll = async (label: 'Toggle Left Panel' | 'Toggle Right Panel') => {
  for (const button of screen.getAllByRole('button', { name: label })) {
    await userEvent.click(button);
  }
};

const expectSingleChrome = () => {
  expect(count('main-content')).toBe(1);
  expect(count('header-content')).toBe(1);
  expect(count('actions-probe')).toBe(1);
  expect(toggleCount('Toggle Left Panel')).toBe(1);
  expect(toggleCount('Toggle Right Panel')).toBe(1);
};

// --- tests -----------------------------------------------------------------

describe('ThreeColumns acceptance (DEV-893)', () => {
  describe('1. main panel, header, toolbar and actions mount exactly once', () => {
    it.each([
      ['phone', PHONE],
      ['tablet (768)', TABLET],
      ['desktop', DESKTOP],
    ])('at %s width (%i)', (_label, width) => {
      setViewport(width);
      render(<Layout />);

      expectSingleChrome();
      // the main-panel probe really mounted once, not twice
      expect(mounts.filter((m) => m === 'main')).toHaveLength(1);
      expect(mounts.filter((m) => m === 'actions')).toHaveLength(1);
    });

    it.each([
      ['phone', PHONE],
      ['desktop', DESKTOP],
    ])('with both side panels open at %s width', (_label, width) => {
      setViewport(width);
      render(<Layout leftPanelOpen rightPanelOpen />);

      expect(count('main-content')).toBe(1);
      expect(count('header-content')).toBe(1);
      expect(count('actions-probe')).toBe(1);
      expect(toggleCount('Toggle Left Panel')).toBe(1);
      expect(toggleCount('Toggle Right Panel')).toBe(1);
    });
  });

  describe('2. server render', () => {
    const html = (props: HarnessProps = {}) =>
      renderToString(<Layout {...props} />);
    const occurrences = (haystack: string, needle: string) =>
      haystack.split(needle).length - 1;

    it('contains the main panel content exactly once', () => {
      setViewport(DESKTOP);
      const out = html();
      expect(occurrences(out, 'data-testid="main-content"')).toBe(1);
      expect(occurrences(out, 'data-testid="header-content"')).toBe(1);
      expect(occurrences(out, 'data-testid="actions-probe"')).toBe(1);
    });

    it('is identical whatever the device width', () => {
      setViewport(DESKTOP);
      const desktopHtml = html({ leftPanelOpen: true, rightPanelOpen: true });
      setViewport(PHONE);
      const phoneHtml = html({ leftPanelOpen: true, rightPanelOpen: true });
      setViewport(TABLET);
      const tabletHtml = html({ leftPanelOpen: true, rightPanelOpen: true });

      expect(phoneHtml).toBe(desktopHtml);
      expect(tabletHtml).toBe(desktopHtml);
    });

    it('renders each open side panel once, with the desktop layout', () => {
      setViewport(PHONE);
      const out = html({ leftPanelOpen: true, rightPanelOpen: true });
      expect(occurrences(out, 'data-testid="left-content"')).toBe(1);
      expect(occurrences(out, 'data-testid="right-content"')).toBe(1);
    });
  });

  describe('3. side panel content renders in exactly one place', () => {
    it('mobile: zero copies while both sheets are closed', () => {
      setViewport(PHONE);
      render(<Layout leftPanelOpen={false} rightPanelOpen={false} />);

      expect(count('left-content')).toBe(0);
      expect(count('right-content')).toBe(0);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('mobile: left content appears once, inside its sheet, only while open', () => {
      setViewport(PHONE);
      const { rerender } = render(
        <Layout leftPanelOpen rightPanelOpen={false} />,
      );

      expect(count('left-content')).toBe(1);
      expect(count('right-content')).toBe(0);
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getAllByTestId('left-content')).toHaveLength(1);

      rerender(<Layout leftPanelOpen={false} rightPanelOpen={false} />);
      expect(count('left-content')).toBe(0);
    });

    it('mobile: right content appears once, inside its sheet, only while open', () => {
      setViewport(PHONE);
      render(<Layout leftPanelOpen={false} rightPanelOpen />);

      expect(count('right-content')).toBe(1);
      expect(count('left-content')).toBe(0);
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getAllByTestId('right-content')).toHaveLength(1);
    });

    it('desktop: each side panel renders exactly one copy, outside any dialog', () => {
      setViewport(DESKTOP);
      render(<Layout leftPanelOpen rightPanelOpen />);

      expect(count('left-content')).toBe(1);
      expect(count('right-content')).toBe(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('4. mobile toggles', () => {
    it('Toggle Left Panel asks to open the left panel', async () => {
      setViewport(PHONE);
      const onLeft = jest.fn();
      const onRight = jest.fn();
      render(
        <Layout
          leftPanelOpen={false}
          rightPanelOpen={false}
          onLeftPanelOpenChange={onLeft}
          onRightPanelOpenChange={onRight}
        />,
      );

      await clickAll('Toggle Left Panel');
      expect(onLeft).toHaveBeenCalledWith(true);
      expect(onRight).not.toHaveBeenCalled();
    });

    it('Toggle Right Panel asks to open the right panel', async () => {
      setViewport(PHONE);
      const onLeft = jest.fn();
      const onRight = jest.fn();
      render(
        <Layout
          leftPanelOpen={false}
          rightPanelOpen={false}
          onLeftPanelOpenChange={onLeft}
          onRightPanelOpenChange={onRight}
        />,
      );

      await clickAll('Toggle Right Panel');
      expect(onRight).toHaveBeenCalledWith(true);
      expect(onLeft).not.toHaveBeenCalled();
    });

    it('opens the sheet when the controlled prop flips to open', async () => {
      setViewport(PHONE);
      render(<StatefulLayout />);
      expect(screen.queryByRole('dialog')).toBeNull();

      await userEvent.click(
        screen.getAllByRole('button', { name: 'Toggle Left Panel' })[0],
      );

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getAllByTestId('left-content')).toHaveLength(1);
      expect(count('right-content')).toBe(0);
    });

    it('with leftPanelOpen the left sheet (role dialog) shows the left content', () => {
      setViewport(PHONE);
      render(<Layout leftPanelOpen />);

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByTestId('left-content')).toBeTruthy();
    });
  });

  describe('5. crossing the breakpoint', () => {
    it('desktop -> mobile closes the open panels', () => {
      setViewport(DESKTOP);
      const onLeft = jest.fn();
      const onRight = jest.fn();
      render(
        <Layout
          leftPanelOpen
          rightPanelOpen
          onLeftPanelOpenChange={onLeft}
          onRightPanelOpenChange={onRight}
        />,
      );
      onLeft.mockClear();
      onRight.mockClear();

      resizeTo(PHONE);

      expect(onLeft).toHaveBeenCalledWith(false);
      expect(onRight).toHaveBeenCalledWith(false);
      expect(onLeft).not.toHaveBeenCalledWith(true);
      expect(onRight).not.toHaveBeenCalledWith(true);
    });

    it('mobile -> desktop closes the open panels', () => {
      setViewport(PHONE);
      const onLeft = jest.fn();
      const onRight = jest.fn();
      render(
        <Layout
          leftPanelOpen
          rightPanelOpen
          onLeftPanelOpenChange={onLeft}
          onRightPanelOpenChange={onRight}
        />,
      );
      onLeft.mockClear();
      onRight.mockClear();

      resizeTo(DESKTOP);

      expect(onLeft).toHaveBeenCalledWith(false);
      expect(onRight).toHaveBeenCalledWith(false);
      expect(onLeft).not.toHaveBeenCalledWith(true);
      expect(onRight).not.toHaveBeenCalledWith(true);
    });

    it('closes only the panel that is open', () => {
      setViewport(DESKTOP);
      const onLeft = jest.fn();
      const onRight = jest.fn();
      render(
        <Layout
          leftPanelOpen
          rightPanelOpen={false}
          onLeftPanelOpenChange={onLeft}
          onRightPanelOpenChange={onRight}
        />,
      );
      onLeft.mockClear();
      onRight.mockClear();

      resizeTo(PHONE);

      expect(onLeft).toHaveBeenCalledWith(false);
      expect(onRight).not.toHaveBeenCalledWith(true);
    });

    it('a stateful parent ends up with no sheet open after desktop -> mobile', () => {
      setViewport(DESKTOP);
      render(<StatefulLayout initialLeft initialRight />);
      expect(count('left-content')).toBe(1);
      expect(count('right-content')).toBe(1);

      resizeTo(PHONE);

      expect(count('left-content')).toBe(0);
      expect(count('right-content')).toBe(0);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('does not remount the main panel across desktop -> mobile -> desktop', async () => {
      setViewport(DESKTOP);
      render(<StatefulLayout initialLeft initialRight />);

      await userEvent.click(screen.getByTestId('main-increment'));
      await userEvent.click(screen.getByTestId('main-increment'));
      expect(screen.getByTestId('main-count').textContent).toBe('2');
      const mainNode = screen.getByTestId('main-content');

      resizeTo(PHONE);
      expect(count('main-content')).toBe(1);
      expect(screen.getByTestId('main-count').textContent).toBe('2');
      expect(screen.getByTestId('main-content')).toBe(mainNode);

      resizeTo(DESKTOP);
      expect(count('main-content')).toBe(1);
      expect(screen.getByTestId('main-count').textContent).toBe('2');
      expect(screen.getByTestId('main-content')).toBe(mainNode);

      expect(mounts.filter((m) => m === 'main')).toHaveLength(1);
      expect(unmounts.filter((m) => m === 'main')).toHaveLength(0);
    });

    it('does not remount the main panel across mobile -> desktop -> mobile', async () => {
      setViewport(PHONE);
      render(<StatefulLayout />);

      await userEvent.click(screen.getByTestId('main-increment'));
      expect(screen.getByTestId('main-count').textContent).toBe('1');

      resizeTo(DESKTOP);
      expect(screen.getByTestId('main-count').textContent).toBe('1');
      resizeTo(PHONE);
      expect(screen.getByTestId('main-count').textContent).toBe('1');

      expect(mounts.filter((m) => m === 'main')).toHaveLength(1);
      expect(unmounts.filter((m) => m === 'main')).toHaveLength(0);
    });

    it('keeps the header and toolbar single across the breakpoint', () => {
      setViewport(DESKTOP);
      render(<StatefulLayout />);
      expectSingleChrome();

      resizeTo(PHONE);
      expectSingleChrome();

      resizeTo(DESKTOP);
      expectSingleChrome();
    });
  });

  describe('6. mainPanelActions survive the breakpoint', () => {
    it('stay mounted once, keeping their state, across a resize', async () => {
      setViewport(DESKTOP);
      render(<StatefulLayout />);
      expect(count('actions-probe')).toBe(1);

      await userEvent.click(screen.getByTestId('actions-increment'));
      expect(screen.getByTestId('actions-count').textContent).toBe('1');

      resizeTo(PHONE);
      expect(count('actions-probe')).toBe(1);
      expect(screen.getByTestId('actions-count').textContent).toBe('1');

      resizeTo(DESKTOP);
      expect(count('actions-probe')).toBe(1);
      expect(screen.getByTestId('actions-count').textContent).toBe('1');

      expect(mounts.filter((m) => m === 'actions')).toHaveLength(1);
      expect(unmounts.filter((m) => m === 'actions')).toHaveLength(0);
    });
  });

  describe('7. rightPanelEnabled={false}', () => {
    it.each([
      ['phone', PHONE],
      ['desktop', DESKTOP],
    ])('has no right toggle and no right content at %s width', (_l, width) => {
      setViewport(width);
      render(<Layout rightPanelEnabled={false} rightPanelOpen />);

      expect(toggleCount('Toggle Right Panel')).toBe(0);
      expect(count('right-content')).toBe(0);
    });

    it('stays absent after crossing the breakpoint', () => {
      setViewport(DESKTOP);
      render(<Layout rightPanelEnabled={false} rightPanelOpen />);

      resizeTo(PHONE);
      expect(toggleCount('Toggle Right Panel')).toBe(0);
      expect(count('right-content')).toBe(0);

      resizeTo(DESKTOP);
      expect(toggleCount('Toggle Right Panel')).toBe(0);
      expect(count('right-content')).toBe(0);
    });

    it('is also absent from the server HTML', () => {
      setViewport(DESKTOP);
      const out = renderToString(
        <Layout rightPanelEnabled={false} rightPanelOpen />,
      );
      expect(out).not.toContain('data-testid="right-content"');
      expect(out).not.toContain('Toggle Right Panel');
    });
  });
});
