'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { memo, useEffect, useMemo, useRef } from 'react';
import type { PassageMeta } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { StackRow } from './StackRow';
import { stackPerf } from './perf';

/**
 * One small TipTap editor bound to one passage's Yjs doc. Mounted only while
 * the passage is inside the live set; the document (and any edits) outlive the
 * editor in the work's passage store.
 *
 * The caller guarantees the passage is hydrated — `PassageStack` renders this
 * tier only for rows `controller.isLive` accepts, which requires a document.
 * Mounting on an unhydrated passage would bind the editor to an empty
 * document and overwrite the real content on the first keystroke.
 */
export const StackPassageEditor = memo(
  ({
    controller,
    meta,
    focused,
  }: {
    controller: PassageStackController;
    meta: PassageMeta;
    focused: boolean;
  }) => {
    const mountStart = useRef(0);
    const uuid = meta.uuid;

    const extensions = useMemo(() => {
      mountStart.current = performance.now();
      return controller.buildEditorExtensions(uuid);
    }, [controller, uuid]);

    const editor = useEditor(
      {
        extensions,
        immediatelyRender: false,
        shouldRerenderOnTransaction: false,
        // Neighbors premount non-editable so only the focused passage is a
        // contenteditable; the controller flips this on focus.
        editable: focused,
        editorProps: {
          attributes: {
            spellcheck: 'false',
            autocomplete: 'off',
            autocorrect: 'off',
            autocapitalize: 'off',
            class: 'focus:outline-none',
          },
        },
        onCreate: ({ editor: created }) => {
          controller.registerEditor(uuid, created);
          stackPerf.recordMount(performance.now() - mountStart.current);
        },
        onFocus: () => {
          // Clicks land directly in premounted neighbors — keep the live
          // window centered on wherever focus actually is.
          controller.notifyFocused(uuid);
        },
        onDestroy: () => {
          controller.unregisterEditor(uuid);
        },
      },
      [controller, uuid],
    );

    useEffect(() => {
      if (editor && editor.isEditable !== focused) {
        editor.setEditable(focused);
      }
    }, [editor, focused]);

    return (
      <StackRow
        uuid={uuid}
        label={meta.label}
        bookmarked={controller.showsBookmark(uuid)}
      >
        <EditorContent editor={editor} />
      </StackRow>
    );
  },
);
