import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { mentionSuggestion } from './MentionSuggestion';
import { MentionSearchResult } from './useMentionSearch';

// MentionList reaches lib-search -> next/server, which jsdom cannot load.
jest.mock('./MentionList', () => ({ __esModule: true, default: () => null }));

const mockRendererDestroy = jest.fn();
const mockUpdateProps = jest.fn();
jest.mock('@tiptap/react', () => ({
  ReactRenderer: jest.fn().mockImplementation(() => ({
    element: globalThis.document.createElement('div'),
    destroy: mockRendererDestroy,
    updateProps: mockUpdateProps,
    ref: { onKeyDown: () => true },
  })),
}));

const mockPopupDestroy = jest.fn();
jest.mock('tippy.js', () => ({
  __esModule: true,
  default: jest.fn(() => [
    { destroy: mockPopupDestroy, hide: jest.fn(), setProps: jest.fn() },
  ]),
}));

type Props = SuggestionProps<MentionSearchResult>;

const props = {
  editor: { isDestroyed: false },
  clientRect: () => new DOMRect(),
} as Props;
const keyDown = (key: string) =>
  ({ event: new KeyboardEvent('keydown', { key }) }) as SuggestionKeyDownProps;

const createRenderer = () => {
  const renderer = mentionSuggestion.render?.();
  if (!renderer) throw new Error('mentionSuggestion has no renderer');
  return renderer;
};

describe('mentionSuggestion renderer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tolerates exit, update and keydown before the popup has started', () => {
    const renderer = createRenderer();

    expect(() => renderer.onUpdate?.(props)).not.toThrow();
    expect(renderer.onKeyDown?.(keyDown('ArrowDown'))).toBe(false);
    expect(renderer.onKeyDown?.(keyDown('Escape'))).toBe(true);
    expect(() => renderer.onExit?.(props)).not.toThrow();
    expect(mockRendererDestroy).not.toHaveBeenCalled();
    expect(mockPopupDestroy).not.toHaveBeenCalled();
  });

  it('destroys the popup once, even when exit fires twice', () => {
    const renderer = createRenderer();
    renderer.onStart?.(props);

    renderer.onExit?.(props);
    expect(() => renderer.onExit?.(props)).not.toThrow();

    expect(mockRendererDestroy).toHaveBeenCalledTimes(1);
    expect(mockPopupDestroy).toHaveBeenCalledTimes(1);
  });

  it('forwards updates and keys to a started popup', () => {
    const renderer = createRenderer();
    renderer.onStart?.(props);

    renderer.onUpdate?.(props);
    expect(mockUpdateProps).toHaveBeenCalledWith(props);
    expect(renderer.onKeyDown?.(keyDown('ArrowDown'))).toBe(true);
  });

  it('opens no popup for a start that lands after its editor is destroyed', () => {
    const renderer = createRenderer();
    renderer.onExit?.(props);

    renderer.onStart?.({
      ...props,
      editor: { isDestroyed: true },
    } as unknown as Props);

    expect(jest.requireMock('tippy.js').default).not.toHaveBeenCalled();
  });

  it('replaces the popup when a second start arrives', () => {
    const renderer = createRenderer();
    renderer.onStart?.(props);
    renderer.onStart?.(props);

    expect(mockRendererDestroy).toHaveBeenCalledTimes(1);
    expect(mockPopupDestroy).toHaveBeenCalledTimes(1);
  });
});
