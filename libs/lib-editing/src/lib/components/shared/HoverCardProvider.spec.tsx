import { Editor } from '@tiptap/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { registerEditorElement } from '../editor/util';
import { HoverCardProvider } from './HoverCardProvider';
import { NavigationContext, type NavigationState } from './NavigationContext';

/**
 * Whether cards are offered is an application-level fact now, so a test has to
 * say which application it is standing in.
 */
const inStudio = (
  ui: ReactNode,
  { editable = true }: { editable?: boolean } = {},
) => (
  <NavigationContext.Provider value={{ editable } as NavigationState}>
    {ui}
  </NavigationContext.Provider>
);

jest.mock('./TranslationHoverCard', () => ({
  TranslationHoverCard: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('../editor/extensions/GlossaryInstance/GlossaryInstance', () => ({
  GlossaryInstance: () => null,
}));
jest.mock('../editor/extensions/EndNoteLink/EndNoteLinkHoverContent', () => ({
  EndNoteLinkHoverContent: () => null,
}));
jest.mock('../editor/extensions/Link/LinkHoverContent', () => ({
  LinkHoverContent: () => null,
}));
jest.mock('../editor/extensions/InternalLink/InternalLinkHoverContent', () => ({
  InternalLinkHoverContent: () => <div>Internal link hover card</div>,
}));
jest.mock('../editor/extensions/Mention/MentionHoverContent', () => ({
  MentionHoverContent: ({ editable }: { editable: boolean }) => (
    <div data-editable={String(editable)}>Mention hover card</div>
  ),
}));

const MENTION_UUID_ATTR = { uuid: 'mention-id' } as Record<string, string>;

describe('HoverCardProvider', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('dismisses the hover card when a drag starts', () => {
    jest.useFakeTimers();
    const { container } = render(
      inStudio(
        <HoverCardProvider openDelay={0} closeDelay={0}>
          <span className="mention-container" draggable>
            {/* The editor renders mention anchors with a bare `uuid` attribute,
              which HoverCardProvider reads back with getAttribute. React
              forwards unknown lowercase attributes to the DOM; only the JSX
              types object, hence the spread. */}
            <a href="/mention" type="mention" {...MENTION_UUID_ATTR}>
              Mention
            </a>
          </span>
        </HoverCardProvider>,
      ),
    );
    const anchor = screen.getByRole('link', { name: 'Mention' });
    registerEditorElement(anchor, { isEditable: true } as Editor);

    fireEvent.mouseEnter(anchor);
    act(() => jest.runOnlyPendingTimers());

    expect(screen.getByText('Mention hover card')).not.toBeNull();

    const mention = container.querySelector('.mention-container');
    expect(mention).not.toBeNull();
    fireEvent.dragStart(mention as HTMLElement);

    expect(screen.queryByText('Mention hover card')).toBeNull();
  });

  it('shows a card over an anchor with no editor mounted', () => {
    jest.useFakeTimers();
    render(
      inStudio(
        <HoverCardProvider openDelay={0} closeDelay={0}>
          <a href="/mention" type="mention" {...MENTION_UUID_ATTR}>
            Mention
          </a>
        </HoverCardProvider>,
      ),
    );
    const anchor = screen.getByRole('link', { name: 'Mention' });
    // Deliberately unregistered: most of a virtualized work is static HTML,
    // and a card's content comes from the anchor and the navigation fetchers.
    fireEvent.mouseEnter(anchor);
    act(() => jest.runOnlyPendingTimers());

    expect(screen.getByText('Mention hover card')).not.toBeNull();
  });

  it('shows a card over a non-editable editor', () => {
    jest.useFakeTimers();
    render(
      inStudio(
        <HoverCardProvider openDelay={0} closeDelay={0}>
          <a href="/mention" type="mention" {...MENTION_UUID_ATTR}>
            Mention
          </a>
        </HoverCardProvider>,
      ),
    );
    const anchor = screen.getByRole('link', { name: 'Mention' });
    registerEditorElement(anchor, { isEditable: false } as Editor);

    fireEvent.mouseEnter(anchor);
    act(() => jest.runOnlyPendingTimers());

    // A premounted neighbour is not editable; that says nothing about whether
    // the work is being edited.
    expect(screen.getByText('Mention hover card')).not.toBeNull();
  });

  /** Hover an anchor of `type` and let the open delay pass. */
  const hover = (
    type: string,
    options: { editable?: boolean; enabled?: boolean } = {},
  ) => {
    jest.useFakeTimers();
    render(
      inStudio(
        <HoverCardProvider
          openDelay={0}
          closeDelay={0}
          enabled={options.enabled ?? true}
        >
          <a href="/anchor" type={type} {...MENTION_UUID_ATTR}>
            Anchor
          </a>
        </HoverCardProvider>,
        { editable: options.editable },
      ),
    );
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Anchor' }));
    act(() => jest.runOnlyPendingTimers());
  };

  it('shows a reader a card without its edit actions', () => {
    hover('mention', { editable: false });

    const card = screen.getByText('Mention hover card');
    expect(card.dataset['editable']).toBe('false');
  });

  it('offers the studio its edit actions', () => {
    hover('mention');

    const card = screen.getByText('Mention hover card');
    expect(card.dataset['editable']).toBe('true');
  });

  it('shows a reader no card for an internal link', () => {
    hover('internalLink', { editable: false });

    expect(screen.queryByText('Internal link hover card')).toBeNull();
  });

  it('shows the studio a card for an internal link', () => {
    hover('internalLink');

    expect(screen.getByText('Internal link hover card')).toBeTruthy();
  });

  it('draws nothing when the host turns cards off', () => {
    hover('mention', { enabled: false });

    expect(screen.queryByText('Mention hover card')).toBeNull();
  });
});
