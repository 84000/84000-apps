'use client';

import { useEffect } from 'react';

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
export const useStackSelection = (controller: PassageStackController) => {
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

      if (!selection.anchorNode || !selection.focusNode) {
        controller.setCrossSelection(null);
        return;
      }

      const fromPos = controller.resolvePoint(
        anchorUuid,
        selection.anchorNode,
        selection.anchorOffset,
      );
      const toPos = controller.resolvePoint(
        focusUuid,
        selection.focusNode,
        selection.focusOffset,
      );
      if (fromPos === null || toPos === null) {
        controller.setCrossSelection(null);
        return;
      }

      controller.setCrossSelection({
        fromUuid: anchorUuid,
        fromPos,
        toUuid: focusUuid,
        toPos,
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (!controller.hasCrossSelection()) return;
      event.preventDefault();
      event.stopPropagation();
      controller.deleteCrossSelection();
    };

    // Document-level: with static rows the selection can exist while focus
    // sits on <body>, so a container listener would never hear the key.
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [controller]);
};
