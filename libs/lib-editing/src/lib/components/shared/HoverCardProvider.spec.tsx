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
  InternalLinkHoverContent: () => null,
}));
jest.mock('../editor/extensions/Mention/MentionHoverContent', () => ({
  MentionHoverContent: () => <div>Mention hover card</div>,
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

  it('offers no card in the reader', () => {
    jest.useFakeTimers();
    render(
      inStudio(
        <HoverCardProvider openDelay={0} closeDelay={0}>
          <a href="/mention" type="mention" {...MENTION_UUID_ATTR}>
            Mention
          </a>
        </HoverCardProvider>,
        { editable: false },
      ),
    );
    const anchor = screen.getByRole('link', { name: 'Mention' });
    registerEditorElement(anchor, { isEditable: true } as Editor);

    fireEvent.mouseEnter(anchor);
    act(() => jest.runOnlyPendingTimers());

    expect(screen.queryByText('Mention hover card')).toBeNull();
  });
});
