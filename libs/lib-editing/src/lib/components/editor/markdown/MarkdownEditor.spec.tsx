import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdownFormatOf, serializeMarkdown } from './markdown-codec';
import { editTextNodes } from './markdown-editing.fixture';
import { MarkdownEditor } from './MarkdownEditor';

const ROUND_TRIPS = '# Title\n\nA *short* policy.\n';
const FALLS_BACK = 'Use _italics_ for titles.\n';

const setup = (source: string, editable = true) => {
  const onChange = jest.fn();
  const onModeChange = jest.fn();
  let editor: Editor | null = null;
  const view = render(
    <MarkdownEditor
      source={source}
      editable={editable}
      onChange={onChange}
      onModeChange={onModeChange}
      menu={(instance) => {
        editor = instance;
        return null;
      }}
    />,
  );
  return { ...view, onChange, onModeChange, editor: () => editor };
};

describe('MarkdownEditor', () => {
  describe('when the source round-trips', () => {
    it('opens the rich editor without reporting a change', async () => {
      const { container, onChange, onModeChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());

      expect(onModeChange).toHaveBeenCalledWith('rich', undefined);
      expect(
        container.querySelector('[data-markdown-mode="rich"]'),
      ).not.toBeNull();
      expect(screen.queryByRole('note')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('reports serialized markdown, clean again once it matches', async () => {
      const { onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());

      act(() => {
        editor()?.commands.insertContentAt(
          editor()?.state.doc.content.size ?? 0,
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'More.' }],
          },
        );
      });
      expect(onChange).toHaveBeenLastCalledWith(
        '# Title\n\nA *short* policy.\n\nMore.\n',
        true,
        true,
      );

      act(() => {
        editor()?.commands.undo();
      });
      expect(onChange).toHaveBeenLastCalledWith(ROUND_TRIPS, false, true);
    });

    it('does not edit a document by mounting it', async () => {
      const source = readFileSync(
        join(__dirname, '../../../../fixtures/policies/synthetic/rich.md'),
        'utf8',
      );
      const { onChange, editor } = setup(source);
      await waitFor(() => expect(editor()).not.toBeNull());

      const json = editor()?.getJSON() ?? {};
      expect(serializeMarkdown(json, markdownFormatOf(source))).toEqual({
        markdown: source,
        exact: true,
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps soft wraps when a wrapped paragraph is typed in', async () => {
      const source = '# Title\n\nAn excerpt\nfrom the source.\n';
      const { onChange, editor } = setup(source);
      await waitFor(() => expect(editor()).not.toBeNull());

      act(() => {
        editTextNodes(editor() as Editor, (text) =>
          text.endsWith('source.') ? `${text.slice(0, -1)}, edited.` : null,
        );
      });

      expect(onChange).toHaveBeenLastCalledWith(
        '# Title\n\nAn excerpt\nfrom the source, edited.\n',
        true,
        true,
      );
    });

    it('follows a new source, switching mode when it must', async () => {
      const { rerender, onChange, onModeChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      const props = { editable: true, onChange, onModeChange };

      rerender(<MarkdownEditor {...props} source={'Another policy.\n'} />);
      expect(editor()?.getText()).toBe('Another policy.');

      rerender(<MarkdownEditor {...props} source={FALLS_BACK} />);
      expect(onModeChange).toHaveBeenLastCalledWith('raw', 'not-identical');
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        FALLS_BACK,
      );

      const other = '* Another fallback.\n';
      rerender(<MarkdownEditor {...props} source={other} />);
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        other,
      );
    });

    it('discards unsaved edits for a new source, and says so', async () => {
      const { rerender, onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      act(() => {
        editor()?.commands.insertContent('Typed ');
      });
      expect(onChange).toHaveBeenLastCalledWith(expect.any(String), true, true);

      const reloaded = '# Reloaded\n';
      const calls = onChange.mock.calls.length;
      rerender(
        <MarkdownEditor source={reloaded} editable onChange={onChange} />,
      );
      expect(onChange.mock.calls.slice(calls)).toEqual([
        [reloaded, false, true],
      ]);
      expect(editor()?.getText()).toBe('Reloaded');
      // The replacement is not undoable; undo has nothing left to take back.
      act(() => {
        editor()?.commands.undo();
      });
      expect(editor()?.getText()).toBe('Reloaded');
    });

    it('reports rich edits discarded by a new raw source, once', async () => {
      const { rerender, onChange, editor } = setup('# T\n');
      await waitFor(() => expect(editor()).not.toBeNull());
      act(() => {
        editor()?.commands.insertContent('Typed ');
      });
      const calls = onChange.mock.calls.length;
      rerender(
        <MarkdownEditor source={FALLS_BACK} editable onChange={onChange} />,
      );
      expect(onChange.mock.calls.slice(calls)).toEqual([
        [FALLS_BACK, false, true],
      ]);
    });

    it('reports the mode once, whatever the callback identity', async () => {
      const { rerender, onChange, onModeChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      const calls = onModeChange.mock.calls.length;
      rerender(
        <MarkdownEditor
          source={ROUND_TRIPS}
          editable
          onChange={onChange}
          onModeChange={(...args) => onModeChange(...args)}
        />,
      );
      expect(onModeChange.mock.calls.length).toBe(calls);
    });

    it('warns while the content has no exact markdown', async () => {
      const { onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      act(() => {
        // A backtick inside inline code cannot be written as markdown.
        editor()?.commands.insertContent({
          type: 'text',
          text: 'a`b',
          marks: [{ type: 'code' }],
        });
      });
      expect(onChange).toHaveBeenLastCalledWith(
        expect.any(String),
        true,
        false,
      );
      expect(screen.getByRole('status').textContent).toMatch(
        /cannot be saved exactly.*Undo it or rephrase it/,
      );

      act(() => {
        editor()?.commands.undo();
      });
      expect(onChange).toHaveBeenLastCalledWith(ROUND_TRIPS, false, true);
      expect(screen.getByRole('status').textContent).toBe('');
    });

    const append = (editor: Editor | null, text: string) =>
      act(() => {
        editor?.commands.insertContentAt(editor.state.doc.content.size, {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        });
      });

    it('keeps the content when the caller echoes back what it saved', async () => {
      const { rerender, onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      append(editor(), 'More.');
      const saved = onChange.mock.lastCall?.[0];
      const calls = onChange.mock.calls.length;
      rerender(<MarkdownEditor source={saved} editable onChange={onChange} />);
      // Clean against the saved bytes, and nothing replaced.
      expect(onChange.mock.calls.slice(calls)).toEqual([[saved, false, true]]);
      expect(editor()?.getText()).toContain('More.');
      // Undo still reaches back past the save.
      act(() => {
        editor()?.commands.undo();
      });
      expect(onChange).toHaveBeenLastCalledWith(ROUND_TRIPS, true, true);
    });

    it('echoes a save once per report when the same markdown was saved twice', async () => {
      const { rerender, onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      // Reach A, then B, then A again, saving each.
      append(editor(), 'A.');
      const a = onChange.mock.lastCall?.[0];
      append(editor(), 'B.');
      const b = onChange.mock.lastCall?.[0];
      act(() => {
        const { doc } = editor()?.state ?? {};
        const end = doc?.content.size ?? 0;
        editor()?.commands.deleteRange({
          from: end - (doc?.lastChild?.nodeSize ?? 0),
          to: end,
        });
      });
      expect(onChange).toHaveBeenLastCalledWith(a, true, true);

      // The responses arrive in order, with typing in between.
      const calls = onChange.mock.calls.length;
      rerender(<MarkdownEditor source={a} editable onChange={onChange} />);
      append(editor(), 'X.');
      rerender(<MarkdownEditor source={b} editable onChange={onChange} />);
      append(editor(), 'Y.');
      rerender(<MarkdownEditor source={a} editable onChange={onChange} />);

      // Never replaced: every report is of the content, none is the source.
      expect(
        onChange.mock.calls.slice(calls).map(([markdown]) => markdown),
      ).not.toContain(ROUND_TRIPS);
      const text = editor()?.getText() ?? '';
      expect(text).toContain('X.');
      expect(text).toContain('Y.');
      expect(text).not.toContain('B.');
      // Reported as the current content, dirty against the last echo.
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining('X.\n\nY.\n'),
        true,
        true,
      );
      // Undo still reaches back past the saves.
      act(() => {
        editor()?.commands.undo();
      });
      expect(editor()?.getText()).not.toContain('Y.');
    });

    it('keeps typing done while a save was in flight', async () => {
      const { rerender, onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      append(editor(), 'Saved.');
      const saved = onChange.mock.lastCall?.[0];
      append(editor(), 'Typed after.');
      const current = onChange.mock.lastCall?.[0];
      expect(current).toContain('Typed after.');

      const calls = onChange.mock.calls.length;
      rerender(<MarkdownEditor source={saved} editable onChange={onChange} />);
      expect(onChange.mock.calls.slice(calls)).toEqual([[current, true, true]]);
      expect(editor()?.getText()).toContain('Typed after.');

      // Later edits are dirty against the save, not the first load.
      act(() => {
        const { doc } = editor()?.state ?? {};
        const end = doc?.content.size ?? 0;
        editor()?.commands.deleteRange({
          from: end - (doc?.lastChild?.nodeSize ?? 0),
          to: end,
        });
      });
      expect(onChange).toHaveBeenLastCalledWith(saved, false, true);
    });

    it('resets to the first source when it is sent again after an echo', async () => {
      const { rerender, onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      append(editor(), 'Saved.');
      const saved = onChange.mock.lastCall?.[0];
      rerender(<MarkdownEditor source={saved} editable onChange={onChange} />);
      append(editor(), 'Typed.');

      // E.g. a rollback, or a reload after a conflict.
      const calls = onChange.mock.calls.length;
      rerender(
        <MarkdownEditor source={ROUND_TRIPS} editable onChange={onChange} />,
      );
      expect(onChange.mock.calls.slice(calls)).toEqual([
        [ROUND_TRIPS, false, true],
      ]);
      const json = editor()?.getJSON() ?? {};
      expect(
        serializeMarkdown(json, markdownFormatOf(ROUND_TRIPS)).markdown,
      ).toBe(ROUND_TRIPS);
    });

    it('neither warns nor writes &nbsp; for Enter twice at the end', async () => {
      const { onChange, editor } = setup(ROUND_TRIPS);
      await waitFor(() => expect(editor()).not.toBeNull());
      act(() => {
        editor()?.commands.focus('end');
      });
      act(() => {
        editor()?.commands.enter();
      });
      act(() => {
        editor()?.commands.enter();
      });
      expect(editor()?.getJSON().content).toHaveLength(4);
      expect(onChange).toHaveBeenLastCalledWith(ROUND_TRIPS, false, true);
      expect(screen.getByRole('status').textContent).toBe('');
    });
  });

  describe('when the source does not round-trip', () => {
    it('warns and shows the exact source as raw markdown', () => {
      const { container, onModeChange } = setup(FALLS_BACK);

      expect(onModeChange).toHaveBeenCalledWith('raw', 'not-identical');
      expect(
        container.querySelector('[data-markdown-mode="raw"]'),
      ).not.toBeNull();
      expect(screen.getByRole('note').textContent).toMatch(/raw markdown/);
      const textarea = screen.getByRole('textbox', {
        name: 'Markdown source',
      }) as HTMLTextAreaElement;
      expect(textarea.value).toBe(FALLS_BACK);
      expect(textarea.readOnly).toBe(false);
    });

    it('names an unsupported construct instead of crashing', () => {
      const { onModeChange } = setup('- [ ] task\n');
      expect(onModeChange).toHaveBeenCalledWith('raw', 'unsupported');
      expect(screen.getByRole('textbox')).toBeTruthy();
    });

    it.each([
      ['mixed endings', 'one\r\ntwo\n'],
      ['a lone CR', 'one\rtwo\n'],
      ['mixed endings, unsupported', '- [ ] task\r\n\r\nplain line\n'],
      ['mixed endings and an image', '![i](x)\n\nfoo\r\n'],
    ])('opens %s read-only with a line-ending warning', (_, source) => {
      const { onModeChange, onChange } = setup(source);
      expect(onModeChange).toHaveBeenCalledWith('raw', 'line-endings');
      expect(screen.getByRole('note').textContent).toMatch(/line endings/);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.readOnly).toBe(true);
      // The DOM normalises a textarea's line breaks, which is why it is
      // read-only: no value it reports could be written back faithfully.
      expect(textarea.value).toBe(source.replace(/\r\n?/g, '\n'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it.each([
      ['raw', FALLS_BACK, '* Another fallback.\n'],
      ['rich', FALLS_BACK, ROUND_TRIPS],
    ])(
      'reports raw edits discarded by a new %s source, once',
      async (_, source, next) => {
        const { rerender, onChange } = setup(source);
        fireEvent.change(screen.getByRole('textbox'), {
          target: { value: 'typed' },
        });
        const calls = onChange.mock.calls.length;
        rerender(<MarkdownEditor source={next} editable onChange={onChange} />);
        await waitFor(() =>
          expect(onChange.mock.calls.slice(calls)).toEqual([
            [next, false, true],
          ]),
        );
      },
    );

    it('stays raw when the caller echoes back a save that would round-trip', () => {
      const { rerender, onChange, onModeChange } = setup(FALLS_BACK);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: ROUND_TRIPS } });
      fireEvent.change(textarea, {
        target: { value: `${ROUND_TRIPS}More.\n` },
      });
      const modes = onModeChange.mock.calls.length;
      const calls = onChange.mock.calls.length;

      rerender(
        <MarkdownEditor
          source={ROUND_TRIPS}
          editable
          onChange={onChange}
          onModeChange={onModeChange}
        />,
      );
      expect(onModeChange.mock.calls.length).toBe(modes);
      expect(screen.queryByRole('note')).not.toBeNull();
      const raw = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(raw.value).toBe(`${ROUND_TRIPS}More.\n`);
      expect(onChange.mock.calls.slice(calls)).toEqual([
        [`${ROUND_TRIPS}More.\n`, true, true],
      ]);

      fireEvent.change(raw, { target: { value: ROUND_TRIPS } });
      expect(onChange).toHaveBeenLastCalledWith(ROUND_TRIPS, false, true);
    });

    it('resets to the first source when it is sent again after an echo', () => {
      const { rerender, onChange } = setup(FALLS_BACK);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const saved = `${FALLS_BACK}Saved.\n`;
      fireEvent.change(textarea, { target: { value: saved } });
      rerender(<MarkdownEditor source={saved} editable onChange={onChange} />);
      fireEvent.change(textarea, { target: { value: `${saved}Typed.\n` } });

      const calls = onChange.mock.calls.length;
      rerender(
        <MarkdownEditor source={FALLS_BACK} editable onChange={onChange} />,
      );
      expect(onChange.mock.calls.slice(calls)).toEqual([
        [FALLS_BACK, false, true],
      ]);
      expect(textarea.value).toBe(FALLS_BACK);
    });

    it('echoes a save once per report when the same text was saved twice', () => {
      const { rerender, onChange } = setup(FALLS_BACK);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const a = `${FALLS_BACK}A.\n`;
      const b = `${FALLS_BACK}B.\n`;
      // Reach A, then B, then A again, saving each.
      for (const value of [a, b, a]) {
        fireEvent.change(textarea, { target: { value } });
      }

      // The responses arrive in order, with typing in between.
      const calls = onChange.mock.calls.length;
      rerender(<MarkdownEditor source={a} editable onChange={onChange} />);
      fireEvent.change(textarea, { target: { value: `${a}x` } });
      rerender(<MarkdownEditor source={b} editable onChange={onChange} />);
      fireEvent.change(textarea, { target: { value: `${a}xy` } });
      rerender(<MarkdownEditor source={a} editable onChange={onChange} />);

      // Never replaced: the typing is kept and dirty against the last echo.
      expect(textarea.value).toBe(`${a}xy`);
      expect(
        onChange.mock.calls.slice(calls).map(([markdown]) => markdown),
      ).not.toContain(FALLS_BACK);
      expect(onChange).toHaveBeenLastCalledWith(`${a}xy`, true, true);
    });

    it('replaces the content with a save older than the last echo', () => {
      const { rerender, onChange } = setup(FALLS_BACK);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const older = `${FALLS_BACK}Older.\n`;
      const newer = `${FALLS_BACK}Newer.\n`;
      fireEvent.change(textarea, { target: { value: older } });
      fireEvent.change(textarea, { target: { value: newer } });
      rerender(<MarkdownEditor source={newer} editable onChange={onChange} />);

      // Echoing `newer` forgot `older`, so the echoes kept stay bounded.
      const calls = onChange.mock.calls.length;
      rerender(<MarkdownEditor source={older} editable onChange={onChange} />);
      expect(onChange.mock.calls.slice(calls)).toEqual([[older, false, true]]);
      expect(textarea.value).toBe(older);
    });

    it('is read-only when not editable', () => {
      setup(FALLS_BACK, false);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.readOnly).toBe(true);
    });

    it('is dirty only while the text differs from the source', () => {
      const { onChange } = setup(FALLS_BACK);
      const textarea = screen.getByRole('textbox');

      fireEvent.change(textarea, { target: { value: `${FALLS_BACK}More.\n` } });
      expect(onChange).toHaveBeenLastCalledWith(
        `${FALLS_BACK}More.\n`,
        true,
        true,
      );

      fireEvent.change(textarea, { target: { value: FALLS_BACK } });
      expect(onChange).toHaveBeenLastCalledWith(FALLS_BACK, false, true);
    });

    it("keeps a CRLF source's line endings", () => {
      const source = 'Use _italics_\r\nfor titles.\r\n';
      const { onChange } = setup(source);
      const textarea = screen.getByRole('textbox');

      // A textarea reports LF line endings whatever it was given.
      fireEvent.change(textarea, {
        target: { value: 'Use _italics_\nfor titles.\nMore.\n' },
      });
      expect(onChange).toHaveBeenLastCalledWith(
        'Use _italics_\r\nfor titles.\r\nMore.\r\n',
        true,
        true,
      );

      fireEvent.change(textarea, {
        target: { value: 'Use _italics_\nfor titles.\n' },
      });
      expect(onChange).toHaveBeenLastCalledWith(source, false, true);
    });
  });
});
