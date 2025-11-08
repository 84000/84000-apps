'use client';

import { TohokuCatalogEntry, Work } from '@data-access';
import { useEffect } from 'react';

export const useTohToggle = ({
  toh,
  work,
}: {
  toh?: TohokuCatalogEntry;
  work: Work;
}) => {
  useEffect(() => {
    (async () => {
      const sheets = Array.from(document.styleSheets);
      let sheet: CSSStyleSheet | null | undefined = [...sheets].find((s) => {
        const node = s.ownerNode as HTMLElement | null;
        return node?.id === 'dynamic-visibility-rules';
      });

      if (!sheet) {
        const styleEl = document.createElement('style');
        styleEl.id = 'dynamic-visibility-rules';
        document.head.appendChild(styleEl);
        sheet = styleEl.sheet;
      }

      if (!sheet) {
        console.warn(
          'Could not find or create stylesheet for dynamic class toggling.',
        );
        return;
      }

      // Clear existing rules
      while (sheet.cssRules.length > 0) {
        sheet.deleteRule(0);
      }

      // Add new rules
      const tohs = work.toh;
      tohs
        .filter((cls) => cls !== toh)
        .forEach((cls) => {
          sheet.insertRule(
            `.${cls} { display: none !important; }`,
            sheet.cssRules.length,
          );
        });
    })();
  }, [toh, work.toh]);
};
