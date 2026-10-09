import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { MarkdownEditor } from './MarkdownEditor';

const SOURCE = 'Plain text here.\n';

// jsdom lays nothing out; ProseMirror measures the selection to scroll to it.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

const setup = (source = SOURCE, editable = true) => {
  const onChange = jest.fn();
  let editor: Editor | null = null;
  const view = render(
    <MarkdownEditor
      source={source}
      editable={editable}
      toolbar
      onChange={onChange}
      menu={(instance) => {
        editor = instance;
        return null;
      }}
    />,
  );
  return { ...view, onChange, editor: () => editor as Editor | null };
};

/** Selects "Plain", the first word of {@link SOURCE}. */
const selectFirstWord = (editor: Editor) =>
  act(() => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
  });

const button = (name: string) => screen.getByRole('button', { name });

describe('MarkdownToolbar', () => {
  it('shows only while the rich editor is editable', async () => {
    const { editor, rerender, onChange } = setup();
    await screen.findByRole('toolbar', { name: 'Formatting' });

    rerender(
      <MarkdownEditor
        source={SOURCE}
        editable={false}
        toolbar
        onChange={onChange}
      />,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(editor()).not.toBeNull();
  });

  it('is not offered for raw markdown', () => {
    setup('<div>x</div>\n');
    expect(
      screen.getByRole('textbox', { name: 'Markdown source' }),
    ).toBeTruthy();
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('formats the selection as markdown', async () => {
    const { editor, onChange } = setup();
    await screen.findByRole('toolbar');
    selectFirstWord(editor() as Editor);

    fireEvent.click(button('Bold'));
    expect(onChange).toHaveBeenLastCalledWith(
      '**Plain** text here.\n',
      true,
      true,
    );
    expect(button('Bold').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button('Heading 2'));
    expect(onChange).toHaveBeenLastCalledWith(
      '## **Plain** text here.\n',
      true,
      true,
    );

    fireEvent.click(button('Undo'));
    fireEvent.click(button('Undo'));
    expect(onChange).toHaveBeenLastCalledWith(SOURCE, false, true);
  });

  it('offers undo only once there is something to undo', async () => {
    const { editor } = setup();
    await screen.findByRole('toolbar');
    expect(button('Undo')).toHaveProperty('disabled', true);

    selectFirstWord(editor() as Editor);
    fireEvent.click(button('Italic'));
    expect(button('Undo')).toHaveProperty('disabled', false);
  });

  it('links the selection, and removes the link', async () => {
    const { editor, onChange } = setup();
    await screen.findByRole('toolbar');
    selectFirstWord(editor() as Editor);

    fireEvent.click(button('Link'));
    fireEvent.change(await screen.findByLabelText('Link address'), {
      target: { value: 'https://84000.co' },
    });
    fireEvent.click(button('Apply'));
    expect(onChange).toHaveBeenLastCalledWith(
      '[Plain](https://84000.co) text here.\n',
      true,
      true,
    );
    expect(button('Link').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button('Link'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(SOURCE, false, true),
    );
  });
});
