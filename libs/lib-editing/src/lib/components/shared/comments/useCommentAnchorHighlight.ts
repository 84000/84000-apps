'use client';

import { useEffect } from 'react';
import { anchorSelector } from './selectors';

const STYLE_ELEMENT_ID = 'comment-anchor-highlight';

/**
 * Highlights every anchor of one comment thread in the text.
 *
 * A CSS rule rather than a class on the elements, for the same reason the
 * comment anchor's click handler is delegated from the document: most of a work
 * is static HTML with no editor to ask, and a thread may be anchored several
 * times. The rule matches on the attributes the mark renders either way, so it
 * covers live editors and static rows alike and follows the text as it is
 * edited, with nothing to re-apply.
 *
 * No transition or animation: an animation running while a large subtree is
 * replaced can wedge WebKit's rendering, and a virtualized passage list
 * replaces subtrees continuously.
 */
export const useCommentAnchorHighlight = (commentUuid?: string) => {
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
      console.warn('Could not create the comment highlight stylesheet.');
      return;
    }

    while (sheet.cssRules.length > 0) {
      sheet.deleteRule(0);
    }

    if (commentUuid) {
      try {
        sheet.insertRule(
          `${anchorSelector(commentUuid)} { background-color: var(--color-secondary); color: var(--color-secondary-foreground); }`,
          0,
        );
      } catch (e) {
        console.error('Failed to insert comment highlight rule:', e);
      }
    }

    // Leaving the panel leaves no highlight behind.
    return () => {
      while (sheet.cssRules.length > 0) {
        sheet.deleteRule(0);
      }
    };
  }, [commentUuid]);
};
