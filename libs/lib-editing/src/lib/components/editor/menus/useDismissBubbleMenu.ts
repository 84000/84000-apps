'use client';

import { Editor } from '@tiptap/core';
import { RefObject, useEffect } from 'react';

/**
 * Collapses the editor selection (dismissing the bubble menu) when the user
 * clicks anywhere outside both the menu and the editor itself. Clicks inside
 * the editor are left alone so native selection handling can run.
 */
export const useDismissBubbleMenu = (
  editor: Editor | null,
  menuRef: RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    if (!editor) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      if (editor.view.dom.contains(target)) {
        return;
      }

      if (editor.state.selection.empty) {
        return;
      }

      editor.commands.setTextSelection(editor.state.selection.from);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [editor, menuRef]);
};
