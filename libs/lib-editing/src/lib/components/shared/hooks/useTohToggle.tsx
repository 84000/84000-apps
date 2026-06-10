'use client';

import { TohokuCatalogEntry } from '@eightyfourthousand/data-access';
import { useEffect } from 'react';

export const useTohToggle = ({ toh }: { toh?: TohokuCatalogEntry }) => {
  useEffect(() => {
    let styleEl = document.getElementById(
      'dynamic-visibility-rules',
    ) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-visibility-rules';
      document.head.appendChild(styleEl);
    }

    const sheet = styleEl.sheet;

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

    // A single rule hides every toh-scoped element that doesn't match the
    // active toh. Attribute selectors take a quoted string, so any toh value
    // is safe — unlike class selectors, which require valid CSS identifiers.
    // Only quotes and backslashes need escaping inside the quoted value.
    const escaped = toh?.replace(/["\\]/g, '\\$&');
    const selector = escaped
      ? `[data-toh]:not([data-toh="${escaped}"])`
      : '[data-toh]';
    try {
      sheet.insertRule(`${selector} { display: none; }`, 0);
    } catch (e) {
      console.error('Failed to insert toh visibility rule:', e);
    }
  }, [toh]);
};
