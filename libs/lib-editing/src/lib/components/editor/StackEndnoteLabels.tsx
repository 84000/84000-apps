'use client';

import { useEffect } from 'react';
import { useStackWork } from '../stack/StackWorkProvider';
import { useEditorState } from './EditorProvider';

/**
 * Offers the stack's endnote labels to the editor context while the stack is
 * mounted. Draws nothing.
 */
export const StackEndnoteLabels = () => {
  const spine = useStackWork()?.work.spine;
  const { registerEndnoteLabels } = useEditorState();

  useEffect(() => {
    if (!spine) return;
    registerEndnoteLabels({
      label: (uuid) => spine.meta(uuid)?.label || undefined,
      observe: (listener) => spine.observe(listener),
    });
    return () => registerEndnoteLabels(null);
  }, [spine, registerEndnoteLabels]);

  return null;
};
