'use client';

import type { Editor, JSONContent } from '@tiptap/core';
import { cn } from '@eightyfourthousand/lib-utils';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { EditorCore, type EditorMenuSlot } from '../EditorCore';
import {
  checkMarkdownRoundTrip,
  markdownFormatOf,
  hasMarkdownChanges,
  serializeMarkdown,
  type MarkdownFallbackReason,
} from './markdown-codec';
import { createMarkdownExtensions } from './markdown-extensions';

/**
 * `rich` edits in the markdown subset; `raw` edits the markdown text, used
 * when the source does not round-trip byte for byte.
 */
export type MarkdownEditorMode = 'rich' | 'raw';

/** Props for {@link MarkdownEditor}. */
export type MarkdownEditorProps = {
  /**
   * The markdown as loaded or last saved. Dirtiness is measured against these
   * bytes.
   *
   * A new value is an echo of a save when it equals markdown reported
   * through `onChange` since the content was last replaced, and not before
   * the previous echo: the content and the mode stay as they are, and the
   * current content is reported again, dirty if it has changed since. An echo
   * consumes the earliest matching report and everything reported before it,
   * so markdown reported more than once, e.g. A, B, A, is echoed once per
   * report. Any other new value replaces the content and discards unsaved
   * edits, even one with the bytes of the source first loaded, reported once
   * through `onChange(source, false, true)`; the caller decides when to do
   * that, e.g. a rollback or a reload after a conflict.
   *
   * So a reload equal to markdown reported since the last replacement is
   * taken for an echo and keeps the content: remount with a new `key` to
   * force the reload. And a save response that arrives after a replacement
   * replaces the content again, since nothing reported since matches it.
   */
  source: string;
  editable: boolean;
  /**
   * Called with the markdown to save after each change. `dirty` is false
   * whenever it equals `source` byte for byte. `exact` is false when the
   * markdown would load back as a different document from the one shown;
   * it is always true in raw mode and when `dirty` is false. Never write
   * unless `dirty` and `exact` are both true.
   */
  onChange: (markdown: string, dirty: boolean, exact: boolean) => void;
  /**
   * Called with the mode the source opened in, and whenever a new source
   * changes it (an echo never does); in raw mode, also with why.
   */
  onModeChange?: (
    mode: MarkdownEditorMode,
    reason?: MarkdownFallbackReason,
  ) => void;
  /** Optional menu for the rich editor, e.g. a bubble menu. */
  menu?: EditorMenuSlot;
  className?: string;
};

/** The latest value, for effects that must not rerun when it changes. */
const useLatest = <T,>(value: T) => {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
};

/** What a mode reports: its markdown, and whether that parses back exactly. */
type Report = (markdown: string, exact: boolean) => void;

const WARNING_CLASS =
  'mb-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm';

/**
 * Edits a markdown document without silently reformatting it. A source that
 * round-trips opens in the rich editor; one that does not opens as raw
 * markdown with a warning, read-only when its line endings cannot be kept.
 * The rich editor warns while its content has no exact markdown. Loading,
 * saving and permissions belong to the caller.
 */
export const MarkdownEditor = ({
  source,
  editable,
  onChange,
  onModeChange,
  menu,
  className,
}: MarkdownEditorProps) => {
  // The source the content was last replaced with, and how many times it has
  // been. Each replacement starts a load generation, even with the bytes of
  // the last one, and only a new generation decides the mode: an echoed save
  // never moves the editor between rich and raw.
  const [loaded, setLoaded] = useState(source);
  const [generation, setGeneration] = useState(0);
  const roundTrip = useMemo(() => checkMarkdownRoundTrip(loaded), [loaded]);
  const mode: MarkdownEditorMode = roundTrip.ok ? 'rich' : 'raw';
  const reason = roundTrip.ok ? undefined : roundTrip.reason;
  const onChangeRef = useLatest(onChange);
  const onModeChangeRef = useLatest(onModeChange);
  // The bytes dirtiness is measured against: the loaded source, or the last
  // echo of a save.
  const baseline = useRef(source);
  // The markdown reported since the content was last replaced, from the last
  // echoed save on, in order of report, repeats kept but not back to back; a
  // source among them is an echo.
  const reported = useRef<string[]>([]);
  // The last report, with the exactness of its markdown.
  const latest = useRef<{ markdown: string; exact: boolean } | null>(null);
  const [savable, setSavable] = useState(true);

  useEffect(() => {
    onModeChangeRef.current?.(mode, reason);
  }, [mode, reason, onModeChangeRef]);

  const emit = useCallback<Report>(
    (markdown, exact) => {
      const dirty = hasMarkdownChanges(markdown, baseline.current);
      const ok = exact || !dirty;
      setSavable(ok);
      onChangeRef.current(markdown, dirty, ok);
    },
    [onChangeRef],
  );

  const report = useCallback<Report>(
    (markdown, exact) => {
      if (reported.current.at(-1) !== markdown) {
        reported.current.push(markdown);
      }
      latest.current = { markdown, exact };
      emit(markdown, exact);
    },
    [emit],
  );

  useEffect(() => {
    if (source === baseline.current) {
      return;
    }
    baseline.current = source;
    const echoed = reported.current.indexOf(source);
    if (latest.current && echoed !== -1) {
      // An echo of a save, perhaps of an earlier state than the content's:
      // keep the content, and report it against the new baseline. It and
      // what was reported before it can no longer come back as an echo.
      reported.current.splice(0, echoed + 1);
      emit(latest.current.markdown, latest.current.exact);
      return;
    }
    // Any other new source replaces the content, in whichever mode: say so.
    reported.current = [];
    latest.current = null;
    setLoaded(source);
    setGeneration((current) => current + 1);
    setSavable(true);
    onChangeRef.current(source, false, true);
  }, [source, emit, onChangeRef]);

  return (
    <div
      className={cn('flex flex-col flex-1 min-h-0', className)}
      data-markdown-mode={mode}
    >
      {roundTrip.ok ? (
        <>
          <div role="status">
            {!savable && (
              <p className={WARNING_CLASS}>
                This change cannot be saved exactly as markdown. Undo it or
                rephrase it to save.
              </p>
            )}
          </div>
          <RichMarkdown
            source={loaded}
            generation={generation}
            doc={roundTrip.doc}
            editable={editable}
            onReport={report}
            menu={menu}
          />
        </>
      ) : (
        <RawMarkdown
          source={loaded}
          generation={generation}
          editable={editable && reason !== 'line-endings'}
          reason={roundTrip.reason}
          onReport={report}
        />
      )}
    </div>
  );
};

type ModeProps = Pick<MarkdownEditorProps, 'editable' | 'menu'> & {
  /** The source of the current load generation. */
  source: string;
  /** Bumped by every replacement: the content is reset to `source`. */
  generation: number;
  onReport: Report;
};

const RichMarkdown = ({
  source,
  generation,
  doc,
  editable,
  onReport,
  menu,
}: ModeProps & { doc: JSONContent }) => {
  const extensions = useMemo(() => createMarkdownExtensions(), []);
  const [initial] = useState(doc);
  const [editor, setEditor] = useState<Editor | null>(null);
  const format = useMemo(() => markdownFormatOf(source), [source]);

  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  // A new generation replaces the content, unless the editor already holds
  // it. Keyed on the generation, not the source, so a reload with the bytes
  // of the last one still resets; and not on the editor's arrival, so an edit
  // made before `onCreate` reaches React is kept.
  const loaded = useRef(generation);
  useEffect(() => {
    if (!editor || loaded.current === generation) {
      return;
    }
    loaded.current = generation;
    if (serializeMarkdown(editor.getJSON(), format).markdown === source) {
      return;
    }
    editor
      .chain()
      .setMeta('addToHistory', false)
      .setContent(doc, { emitUpdate: false })
      .run();
  }, [editor, generation, source, doc, format]);

  return (
    <EditorCore
      content={initial}
      extensions={extensions}
      isEditable={editable}
      undoableInitialContent={false}
      menu={menu}
      onCreate={({ editor }) => setEditor(editor)}
      onUpdate={({ editor }) => {
        const { markdown, exact } = serializeMarkdown(editor.getJSON(), format);
        onReport(markdown, exact);
      }}
    />
  );
};

const WARNINGS: Record<MarkdownFallbackReason, string> = {
  'line-endings':
    'This document mixes line endings or has a lone carriage return, which ' +
    'this editor cannot keep exactly, so it is shown read-only as raw markdown.',
  unsupported:
    'This document uses markdown the rich editor does not support, so it is ' +
    'shown as raw markdown.',
  'not-identical':
    'This document uses markdown the rich editor cannot reproduce exactly, ' +
    'so it is shown as raw markdown to avoid reformatting it.',
};

const RawMarkdown = ({
  source,
  generation,
  editable,
  reason,
  onReport,
}: Omit<ModeProps, 'menu'> & { reason: MarkdownFallbackReason }) => {
  const [text, setText] = useState(source);
  const { lineEnding } = markdownFormatOf(source);

  // A new generation replaces the text, even with the bytes of the last one
  // (React's adjust-state-on-prop-change).
  const [loaded, setLoaded] = useState(generation);
  if (loaded !== generation) {
    setLoaded(generation);
    setText(source);
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    // A textarea reports its value with LF line endings whatever it was
    // given, so restore a CRLF source's endings.
    const value =
      lineEnding === '\n'
        ? event.target.value
        : event.target.value.replace(/\r?\n/g, lineEnding);
    setText(value);
    onReport(value, true);
  };

  return (
    <>
      <p role="note" className={WARNING_CLASS}>
        {WARNINGS[reason]}
      </p>
      <textarea
        aria-label="Markdown source"
        className="flex-1 min-h-64 w-full resize-none rounded-md border p-3 font-mono text-sm focus:outline-none"
        value={text}
        readOnly={!editable}
        spellCheck={false}
        onChange={handleChange}
      />
    </>
  );
};
