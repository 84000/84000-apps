import { Editor } from '@tiptap/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { registerEditorElement } from '../editor/util';
import { HoverCardProvider } from './HoverCardProvider';

jest.mock('./TranslationHoverCard', () => ({
  TranslationHoverCard: ({ children }: { children: ReactNode }) => children,
}));

jest.mock(
  '../editor/extensions/GlossaryInstance/GlossaryInstance',
  () => ({ GlossaryInstance: () => null }),
);
jest.mock(
  '../editor/extensions/EndNoteLink/EndNoteLinkHoverContent',
  () => ({ EndNoteLinkHoverContent: () => null }),
);
jest.mock('../editor/extensions/Link/LinkHoverContent', () => ({
  LinkHoverContent: () => null,
}));
jest.mock(
  '../editor/extensions/InternalLink/InternalLinkHoverContent',
  () => ({ InternalLinkHoverContent: () => null }),
);
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
});
