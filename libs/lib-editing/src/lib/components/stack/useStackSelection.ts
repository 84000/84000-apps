'use client';

import { RefObject, useEffect } from 'react';

import { PassageStackController } from './PassageStackController';

const passageUuidFor = (node: Node | null): string | null => {
  const element =
    node instanceof Element ? node : node?.parentElement ?? null;
  return (
    element?.closest<HTMLElement>('[data-stack-passage]')?.dataset[
      'stackPassage'
    ] ?? null
  );
};

/**
 * Tracks DOM selections that span multiple passage editors and routes
 * Backspace/Delete to the controller's orchestrated cross-passage delete.
 * Whether such selections are even possible varies by browser (each editor
 * is its own contenteditable) — one of the questions this spike answers.
 */
export const useStackSelection = (
  controller: PassageStackController,
  containerRef: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    const onSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        controller.setCrossSelection(null);
        return;
      }

      const anchorUuid = passageUuidFor(selection.anchorNode);
      const focusUuid = passageUuidFor(selection.focusNode);
      if (!anchorUuid || !focusUuid || anchorUuid === focusUuid) {
        controller.setCrossSelection(null);
        return;
      }

      const anchorEditor = controller.getEditor(anchorUuid);
      const focusEditor = controller.getEditor(focusUuid);
      if (!anchorEditor || !focusEditor || !selection.anchorNode || !selection.focusNode) {
        controller.setCrossSelection(null);
        return;
      }

      try {
        controller.setCrossSelection({
          fromUuid: anchorUuid,
          fromPos: anchorEditor.view.posAtDOM(
            selection.anchorNode,
            selection.anchorOffset,
          ),
          toUuid: focusUuid,
          toPos: focusEditor.view.posAtDOM(
            selection.focusNode,
            selection.focusOffset,
          ),
        });
      } catch (error) {
        console.error('failed to resolve cross-passage selection', error);
        controller.setCrossSelection(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (!controller.hasCrossSelection()) return;
      event.preventDefault();
      event.stopPropagation();
      controller.deleteCrossSelection();
    };

    const container = containerRef.current;
    document.addEventListener('selectionchange', onSelectionChange);
    container?.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      container?.removeEventListener('keydown', onKeyDown, true);
    };
  }, [controller, containerRef]);
};
