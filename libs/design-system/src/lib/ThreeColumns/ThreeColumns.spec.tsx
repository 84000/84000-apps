import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MainPanel, ThreeColumns } from './ThreeColumns';

// useIsMobile reads innerWidth and subscribes through matchMedia, which jsdom
// lacks.
const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.matchMedia = jest.fn().mockReturnValue({
    matches: width < 768,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
};

beforeAll(() => {
  // react-resizable-panels observes its group.
  global.ResizeObserver = class {
    observe() {
      return;
    }
    unobserve() {
      return;
    }
    disconnect() {
      return;
    }
  } as unknown as typeof ResizeObserver;
});

const mounts = jest.fn();

const Main = () => {
  useEffect(() => {
    mounts();
  }, []);
  return <div data-testid="main">main</div>;
};

const renderColumns = (mountHiddenLayout?: boolean) =>
  render(
    <ThreeColumns
      leftPanelEnabled={false}
      rightPanelEnabled={false}
      mountHiddenLayout={mountHiddenLayout}
    >
      <MainPanel>
        <Main />
      </MainPanel>
    </ThreeColumns>,
  );

beforeEach(() => {
  mounts.mockClear();
});

describe('ThreeColumns', () => {
  it('mounts the main panel in both layouts by default', () => {
    setViewportWidth(1280);
    renderColumns();

    expect(screen.getAllByTestId('main')).toHaveLength(2);
    expect(mounts).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['desktop', 1280],
    ['mobile', 375],
  ])(
    'mounts the main panel once at %s width without the hidden layout',
    (_, width) => {
      setViewportWidth(width);
      const { container } = renderColumns(false);

      expect(screen.getAllByTestId('main')).toHaveLength(1);
      expect(mounts).toHaveBeenCalledTimes(1);
      // The mobile layout is the one CSS hides at md and up.
      expect(container.querySelector('.md\\:hidden') !== null).toBe(
        width < 768,
      );
    },
  );
});
