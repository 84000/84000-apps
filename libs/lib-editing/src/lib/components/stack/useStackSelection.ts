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

    const serializeSelection = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) return null;
      const container = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        container.appendChild(selection.getRangeAt(i).cloneContents());
      }
      return { text: selection.toString(), html: container.innerHTML };
    };

    const writeClipboard = async ({
      text,
      html,
    }: {
      text: string;
      html: string;
    }) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } catch {
        // rich write unavailable (permissions/browser) — plain text will do
        await navigator.clipboard.writeText(text).catch((error) => {
          console.error('failed to write clipboard', error);
        });
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!controller.hasCrossSelection()) return;

      // Cut: the browser won't mutate a selection that spans non-editable
      // rows, so serialize + orchestrated delete ourselves.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
        const serialized = serializeSelection();
        if (!serialized) return;
        event.preventDefault();
        event.stopPropagation();
        writeClipboard(serialized).then(() =>
          controller.deleteCrossSelection(),
        );
        return;
      }

      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      event.preventDefault();
      event.stopPropagation();
      controller.deleteCrossSelection();
    };

    // Paste over a cross-passage selection: orchestrated delete, then the
    // clipboard text lands at the cut point in the first passage.
    const onPaste = (event: ClipboardEvent) => {
      if (!controller.hasCrossSelection()) return;
      const text = event.clipboardData?.getData('text/plain') ?? '';
      event.preventDefault();
      event.stopPropagation();
      controller.pasteCrossSelection(text);
    };

    // Document-level: with static rows the selection can exist while focus
    // sits on <body>, so a container listener would never hear these.
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('paste', onPaste, true);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('paste', onPaste, true);
    };
  }, [controller]);
};
