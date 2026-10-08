import { act, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorCore } from './EditorCore';

const content = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
};

const setup = (undoableInitialContent?: boolean) => {
  const onUpdate = jest.fn();
  let editor: Editor | null = null;
  render(
    <EditorCore
      content={content}
      extensions={[StarterKit]}
      undoableInitialContent={undoableInitialContent}
      onUpdate={onUpdate}
      menu={(instance) => {
        editor = instance;
        return null;
      }}
    />,
  );
  return { onUpdate, editor: () => editor };
};

describe('EditorCore', () => {
  it('loads non-undoable initial content without an update', async () => {
    const { onUpdate, editor } = setup(false);
    await waitFor(() => expect(editor()?.getText()).toBe('Hello'));
    expect(onUpdate).not.toHaveBeenCalled();

    act(() => {
      editor()?.commands.undo();
    });
    expect(editor()?.getText()).toBe('Hello');
  });

  it('loads undoable initial content as an edit by default', async () => {
    const { onUpdate, editor } = setup();
    await waitFor(() => expect(editor()?.getText()).toBe('Hello'));
    expect(onUpdate).toHaveBeenCalled();

    act(() => {
      editor()?.commands.undo();
    });
    expect(editor()?.getText()).toBe('');
  });
});
