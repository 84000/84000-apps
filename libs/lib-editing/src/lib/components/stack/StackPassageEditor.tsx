'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { memo, useMemo, useRef } from 'react';

import { PassageStackController } from './PassageStackController';
import { stackPerf } from './perf';
import type { StackPassageMeta } from './types';

/**
 * One small TipTap editor bound to one passage's Yjs doc. Mounted only while
 * the passage is inside the virtualized window; the doc (and any edits)
 * outlive the editor in the controller.
 */
export const StackPassageEditor = memo(
  ({
    controller,
    meta,
  }: {
    controller: PassageStackController;
    meta: StackPassageMeta;
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

    return (
      <div className="flex gap-4 py-1" data-stack-passage={uuid}>
        <div className="w-14 shrink-0 select-none pt-1 text-right font-sans text-xs text-muted-foreground">
          {meta.label}
        </div>
        <div className="min-w-0 flex-1">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  },
);
