'use client';

import { useEffect } from 'react';

import { PassageStackController } from './PassageStackController';

/** How far the pointer must travel before a press counts as a drag. */
const DRAG_SLOP_PX = 4;

const passageUuidFor = (node: Node | null): string | null => {
  const element =
    node instanceof Element ? node : (node?.parentElement ?? null);
  return (
    element?.closest<HTMLElement>('[data-stack-passage]')?.dataset[
      'stackPassage'
    ] ?? null
  );
};

/** The passage under a point on screen, if any. */
const passageUuidAt = (x: number, y: number): string | null =>
  passageUuidFor(document.elementFromPoint(x, y));

/**
 * Selection that spans passage rows, and the clipboard operations on it.
 *
 * A selection crossing a row boundary snaps to whole passages. Each row is its
 * own editor, and a browser confines a selection that begins inside one
 * `contenteditable` to that element — so a partial range across rows cannot be
 * acquired by dragging, whatever the model could represent. The passage is
 * already the unit of the spine, of a save and of undo, so it is the unit
 * here.
 *
 * Which also means the drag is tracked by pointer position rather than by
 * `selectionchange`: the browser never reports a selection leaving the row it
 * started in, so there is nothing to listen for.
 */
export const useStackSelection = (controller: PassageStackController) => {
  useEffect(() => {
    let anchorUuid: string | null = null;
    let origin: { x: number; y: number } | null = null;

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      // A press anywhere begins a new selection; the old one goes whether or
      // not this one turns into a drag.
      controller.clearPassageSelection();
      anchorUuid = passageUuidFor(event.target as Node);
      origin = anchorUuid ? { x: event.clientX, y: event.clientY } : null;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!anchorUuid || !origin) return;
      // Buttons released outside the window: the drag is over and no mouseup
      // ever arrived.
      if (!(event.buttons & 1)) {
        anchorUuid = null;
        origin = null;
        return;
      }
      if (
        Math.abs(event.clientX - origin.x) < DRAG_SLOP_PX &&
        Math.abs(event.clientY - origin.y) < DRAG_SLOP_PX
      ) {
        return;
      }

      const overUuid = passageUuidAt(event.clientX, event.clientY);
      if (!overUuid) return;
      // Still inside the row the drag began in: an ordinary text selection,
      // which the editor handles.
      if (overUuid === anchorUuid && !controller.hasPassageSelection()) return;

      controller.setPassageSelection(anchorUuid, overUuid);
      // Every move, not only the ones that change the run: the drag that
      // began inside a row goes on extending that row's own selection
      // underneath this one, and two highlights would be visible at once.
      dropNativeSelection();
    };

    /**
     * Let go of the browser's own selection.
     *
     * A passage selection is drawn by the stack, so the blue one beneath it is
     * a second highlight of a different shape saying the same thing.
     */
    const dropNativeSelection = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
    };

    // Refuse a *new* selection while passages are selected. Clearing alone
    // leaves the browser free to start another on the next movement, which is
    // what made the blue flicker back.
    const onSelectStart = (event: Event) => {
      if (!controller.hasPassageSelection()) return;
      event.preventDefault();
    };

    const endDrag = () => {
      anchorUuid = null;
      origin = null;
      // The release itself can leave a range behind on the anchor row.
      if (controller.hasPassageSelection()) dropNativeSelection();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!controller.hasPassageSelection()) return;

      if (event.key === 'Escape') {
        controller.clearPassageSelection();
        return;
      }

      // Cut: the browser will not mutate a selection it does not own, so the
      // clipboard write and the delete are both ours. `cut` does not fire for
      // a selection spanning non-editable rows, hence the keystroke.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'x') {
        const serialized = controller.serializePassageSelection();
        if (!serialized) return;
        event.preventDefault();
        event.stopPropagation();
        writeClipboard(serialized).then(() =>
          controller.deletePassageSelection(),
        );
        return;
      }

      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      event.preventDefault();
      event.stopPropagation();
      controller.deletePassageSelection();
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

    // The event rather than the keystroke, so the Edit menu and the context
    // menu take this path too, and the clipboard is written synchronously.
    const onCopy = (event: ClipboardEvent) => {
      if (!controller.hasPassageSelection()) return;
      const serialized = controller.serializePassageSelection();
      if (!serialized || !event.clipboardData) return;
      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData('text/plain', serialized.text);
      event.clipboardData.setData('text/html', serialized.html);
    };

    // HTML first: it carries the passage boundaries and every annotation.
    // Plain text is the fallback for a clipboard holding nothing else.
    const onPaste = (event: ClipboardEvent) => {
      if (!controller.hasPassageSelection()) return;
      const html = event.clipboardData?.getData('text/html') ?? '';
      const text = event.clipboardData?.getData('text/plain') ?? '';
      event.preventDefault();
      event.stopPropagation();
      controller.pastePassageSelection({ html, text });
    };

    // Document-level: with static rows the selection can exist while focus
    // sits on <body>, so a container listener would never hear these.
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', endDrag, true);
    document.addEventListener('selectstart', onSelectStart, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', onCopy, true);
    document.addEventListener('paste', onPaste, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', endDrag, true);
      document.removeEventListener('selectstart', onSelectStart, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('paste', onPaste, true);
    };
  }, [controller]);
};
