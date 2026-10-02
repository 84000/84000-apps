'use client';

import { useEffect, type RefObject } from 'react';

import { useNavigation } from '../shared/NavigationContext';
import { locationForPassageType } from '../shared/types';
import type { PassageStackController } from './PassageStackController';
import type { StackPassageMenuTarget } from './StackPassageMenu';
import {
  resolveStackLink,
  STACK_LINK_SELECTOR,
  type StackLinkTarget,
} from './stack-links';
import { inCompareSource } from './useStackSelection';

/** How far the pointer may travel and still count as a click, not a drag. */
const CLICK_SLOP_PX = 5;

/**
 * Delegated pointer handling over a stack's rows: back-references, the label
 * menu, content links on static rows, and click-to-focus.
 */
export const useStackRowPointer = ({
  parentRef,
  controller,
  updatePanel,
  followLink,
  setMenuTarget,
}: {
  parentRef: RefObject<HTMLDivElement | null>;
  controller: PassageStackController;
  updatePanel: ReturnType<typeof useNavigation>['updatePanel'];
  followLink: (link: StackLinkTarget) => void;
  setMenuTarget: (target: StackPassageMenuTarget | null) => void;
}) => {
  // A back-reference under a passage opens the passage it names, and a press
  // on one must not focus the row it sits in.
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;
    const onMouseDown = (event: MouseEvent) => {
      const ref = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        '[data-passage-reference]',
      );
      if (!ref) return;
      event.preventDefault();
      event.stopPropagation();
      const { panel, tab } = locationForPassageType(ref.dataset['refType']);
      updatePanel({
        name: panel,
        state: { open: true, tab, hash: ref.dataset['refUuid'] },
      });
    };
    const onClick = (event: MouseEvent) => {
      if (
        (event.target as HTMLElement | null)?.closest(
          '[data-passage-reference]',
        )
      ) {
        event.preventDefault();
      }
    };
    container.addEventListener('mousedown', onMouseDown, true);
    container.addEventListener('click', onClick, true);
    return () => {
      container.removeEventListener('mousedown', onMouseDown, true);
      container.removeEventListener('click', onClick, true);
    };
  }, [updatePanel, parentRef]);

  // Click-to-focus on static rows, via delegation so text drags across
  // static content stay plain selections instead of mounting editors.
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const uuidAt = (target: EventTarget | null) =>
      (target instanceof Element ? target : null)?.closest<HTMLElement>(
        '[data-stack-passage]',
      )?.dataset['stackPassage'] ?? null;

    let down: { x: number; y: number; uuid: string | null } | null = null;
    // A press on a content link, resolved while the element is still live but
    // not acted on until release — see below.
    let pending: { link: StackLinkTarget; x: number; y: number } | null = null;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      down = null;

      // The label is the menu's trigger; the default would move focus.
      const labelEl = target?.closest?.<HTMLElement>('[data-passage-label]');
      if (labelEl) {
        event.preventDefault();
        const rect = labelEl.getBoundingClientRect();
        setMenuTarget({
          uuid: labelEl.dataset['uuid'] ?? '',
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          },
        });
        return;
      }

      if (target?.closest?.('[contenteditable="true"]')) return; // live editors handle their own caret
      if (inCompareSource(target)) return;

      // Content links, before the focus branch below claims the press. A
      // mounted editor handles these from its own mark and node views; a
      // static row has none, so the stack follows them by delegation.
      //
      // Resolved here, while the element is live, but *not* followed here: a
      // press on a link is just as likely to be the start of a selection
      // drag, and both acting on it and calling `preventDefault` stop the
      // browser ever beginning one. Following on release instead needs no
      // element — the target was resolved already — which is what the
      // original reason for acting on mousedown was about.
      const link = resolveStackLink(target, {
        editable: !controller.isReadOnly(),
      });
      if (link) {
        pending = { link, x: event.clientX, y: event.clientY };
        return;
      }

      down = { x: event.clientX, y: event.clientY, uuid: uuidAt(target) };
    };
    const onMouseUp = (event: MouseEvent) => {
      const link = pending;
      pending = null;
      if (link) {
        // Moved, or left a selection behind: the press was a drag, not a
        // click, and following the link would throw the selection away.
        const dragged =
          Math.abs(event.clientX - link.x) > CLICK_SLOP_PX ||
          Math.abs(event.clientY - link.y) > CLICK_SLOP_PX;
        if (!dragged && document.getSelection()?.isCollapsed) {
          followLink(link.link);
        }
        return;
      }

      const start = down;
      down = null;
      if (!start?.uuid) return;
      const moved =
        Math.abs(event.clientX - start.x) > CLICK_SLOP_PX ||
        Math.abs(event.clientY - start.y) > CLICK_SLOP_PX;
      if (moved || !document.getSelection()?.isCollapsed) return;
      if (uuidAt(event.target) !== start.uuid) return;
      controller.focusPassage(start.uuid, {
        x: event.clientX,
        y: event.clientY,
      });
    };

    // Navigation happens on mousedown, but an anchor's own default fires on
    // click — preventing it there is what keeps a static internal link from
    // also loading its href as a page.
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(STACK_LINK_SELECTOR)) event.preventDefault();
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('click', onClick);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('click', onClick);
    };
  }, [controller, followLink, parentRef, setMenuTarget]);
};
