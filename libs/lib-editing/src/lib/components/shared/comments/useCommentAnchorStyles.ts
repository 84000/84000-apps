'use client';

import { useEffect } from 'react';
import { anchorSelector } from './selectors';

const STYLE_ELEMENT_ID = 'comment-anchor-styles';

/**
 * What the text should show for the threads the panel knows about.
 *
 * CSS rules rather than classes on the elements, for the same reason the
 * comment anchor's click handler is delegated from the document: most of a work
 * is static HTML with no editor to ask, and a thread may be anchored several
 * times. The rules match on the attributes the mark renders either way, so they
 * cover live editors and static rows alike and follow the text as it is edited,
 * with nothing to re-apply.
 *
 * No transition or animation: an animation running while a large subtree is
 * replaced can wedge WebKit's rendering, and a virtualized passage list
 * replaces subtrees continuously.
 */
export const useCommentAnchorStyles = ({
  highlighted,
  suppressed = [],
}: {
  /** The thread under the pointer or selected. Every anchor of it is painted. */
  highlighted?: string;
  /**
   * Threads whose anchors should leave no mark on the text — a resolved thread
   * the panel is not listing. Only the marking is dropped, never the text: the
   * mark wraps real content, so hiding the element would hide the words.
   */
  suppressed?: string[];
}) => {
  // A stable dependency: the array identity changes on every render, the
  // content rarely does.
  const suppressedKey = suppressed.join(',');

  useEffect(() => {
    let styleEl = document.getElementById(
      STYLE_ELEMENT_ID,
    ) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ELEMENT_ID;
      document.head.appendChild(styleEl);
    }

    const sheet = styleEl.sheet;
    if (!sheet) {
      console.warn('Could not create the comment anchor stylesheet.');
      return;
    }

    const clear = () => {
      while (sheet.cssRules.length > 0) {
        sheet.deleteRule(0);
      }
    };

    clear();

    const insert = (rule: string) => {
      try {
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch (e) {
        console.error('Failed to insert comment anchor rule:', e);
      }
    };

    const toSuppress = suppressedKey ? suppressedKey.split(',') : [];
    if (toSuppress.length > 0) {
      insert(
        `${toSuppress.map(anchorSelector).join(', ')} { background-color: transparent; cursor: auto; }`,
      );
    }

    // After the suppression, so a thread the panel has brought into view is
    // painted even if it is resolved.
    if (highlighted) {
      insert(
        `${anchorSelector(highlighted)} { background-color: var(--color-secondary); color: var(--color-secondary-foreground); }`,
      );
    }

    // Leaving the panel leaves nothing behind.
    return clear;
  }, [highlighted, suppressedKey]);
};
