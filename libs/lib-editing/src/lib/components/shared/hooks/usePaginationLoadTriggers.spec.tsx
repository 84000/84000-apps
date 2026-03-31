import { act, render, screen } from '@testing-library/react';
import { usePaginationLoadTriggers } from './usePaginationLoadTriggers';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;
  observedElements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.observedElements.add(element);
  };

  disconnect = () => {
    this.observedElements.clear();
  };

  unobserve = (element: Element) => {
    this.observedElements.delete(element);
  };
}

const emitIntersection = ({
  target,
  isIntersecting,
}: {
  target: Element;
  isIntersecting: boolean;
}) => {
  const observer = MockIntersectionObserver.instances.at(-1);

  if (!observer) {
    throw new Error('No IntersectionObserver instance was created.');
  }

  act(() => {
    observer.callback(
      [
        {
          target,
          isIntersecting,
        } as IntersectionObserverEntry,
      ],
      observer as unknown as IntersectionObserver,
    );
  });
};

const HookHarness = ({
  enabled = true,
  startCursor,
  endCursor,
  startIsLoading = false,
  endIsLoading = false,
}: {
  enabled?: boolean;
  startCursor?: string;
  endCursor?: string;
  startIsLoading?: boolean;
  endIsLoading?: boolean;
}) => {
  const {
    loadMoreAtStartRef,
    loadMoreAtEndRef,
    startLoadRequest,
    endLoadRequest,
  } = usePaginationLoadTriggers({
    enabled,
    startCursor,
    endCursor,
    startIsLoading,
    endIsLoading,
  });

  return (
    <div>
      <div data-testid="start-ref" ref={loadMoreAtStartRef} />
      <div data-testid="end-ref" ref={loadMoreAtEndRef} />
      <div data-testid="start-count">{startLoadRequest}</div>
      <div data-testid="end-count">{endLoadRequest}</div>
    </div>
  );
};

describe('usePaginationLoadTriggers', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  it('fires at most one end request until the sentinel leaves and re-enters', () => {
    render(<HookHarness endCursor="end-1" />);

    const endSentinel = screen.getByTestId('end-ref');

    emitIntersection({ target: endSentinel, isIntersecting: true });
    expect(screen.getByTestId('end-count').textContent).toBe('1');

    emitIntersection({ target: endSentinel, isIntersecting: true });
    expect(screen.getByTestId('end-count').textContent).toBe('1');

    emitIntersection({ target: endSentinel, isIntersecting: false });
    emitIntersection({ target: endSentinel, isIntersecting: true });
    expect(screen.getByTestId('end-count').textContent).toBe('2');
  });

  it('fires at most one start request until the sentinel leaves and re-enters', () => {
    render(<HookHarness startCursor="start-1" />);

    const startSentinel = screen.getByTestId('start-ref');

    emitIntersection({ target: startSentinel, isIntersecting: true });
    expect(screen.getByTestId('start-count').textContent).toBe('1');

    emitIntersection({ target: startSentinel, isIntersecting: true });
    expect(screen.getByTestId('start-count').textContent).toBe('1');

    emitIntersection({ target: startSentinel, isIntersecting: false });
    emitIntersection({ target: startSentinel, isIntersecting: true });
    expect(screen.getByTestId('start-count').textContent).toBe('2');
  });

  it('does not observe until enabled', () => {
    const { rerender } = render(<HookHarness enabled={false} endCursor="end-1" />);

    expect(MockIntersectionObserver.instances).toHaveLength(0);

    rerender(<HookHarness enabled endCursor="end-1" />);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
  });

  it('does not queue another end request from visibility churn during loading', () => {
    const { rerender } = render(<HookHarness endCursor="end-1" />);

    const endSentinel = screen.getByTestId('end-ref');

    emitIntersection({ target: endSentinel, isIntersecting: true });
    expect(screen.getByTestId('end-count').textContent).toBe('1');

    rerender(<HookHarness endCursor="end-1" endIsLoading />);

    emitIntersection({ target: endSentinel, isIntersecting: false });
    emitIntersection({ target: endSentinel, isIntersecting: true });
    expect(screen.getByTestId('end-count').textContent).toBe('1');

    rerender(<HookHarness endCursor="end-1" />);
    emitIntersection({ target: endSentinel, isIntersecting: false });
    emitIntersection({ target: endSentinel, isIntersecting: true });
    expect(screen.getByTestId('end-count').textContent).toBe('2');
  });
});
