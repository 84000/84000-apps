import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';

import { MentionAdvancedOverlay } from './MentionAdvancedOverlay';

jest.mock('./MentionSearch', () => ({ MentionSearch: () => null }));

describe('MentionAdvancedOverlay', () => {
  it('registers its picker with the editor’s mentions', () => {
    const mention: { openAdvanced?: unknown } = {};
    const editor = { storage: { mention } } as unknown as Editor;
    const { unmount } = render(<MentionAdvancedOverlay editor={editor} />);
    expect(mention.openAdvanced).toEqual(expect.any(Function));
    unmount();
    expect(mention.openAdvanced).toBeUndefined();
  });

  it('mounts over an editor without mentions', () => {
    const editor = { storage: {} } as unknown as Editor;
    expect(() =>
      render(<MentionAdvancedOverlay editor={editor} />),
    ).not.toThrow();
  });
});
