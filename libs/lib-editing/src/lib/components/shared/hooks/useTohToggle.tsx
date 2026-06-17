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
    // active toh. `data-toh` may hold a comma-separated list (e.g.
    // "toh417,toh418") when content belongs to several tohs, so the active toh
    // is treated as list membership: keep the element visible if its list
    // equals the active toh or contains it as a comma-delimited token (first,
    // middle, or last). The comma boundaries avoid prefix collisions such as
    // "toh41" matching "toh417". Attribute selectors take a quoted string, so
    // any toh value is safe — only quotes and backslashes need escaping.
    const escaped = toh?.replace(/["\\]/g, '\\$&');
    const selector = escaped
      ? `[data-toh]` +
        `:not([data-toh="${escaped}"])` +
        `:not([data-toh^="${escaped},"])` +
        `:not([data-toh*=",${escaped},"])` +
        `:not([data-toh$=",${escaped}"])`
      : '[data-toh]';
    try {
      sheet.insertRule(`${selector} { display: none; }`, 0);
    } catch (e) {
      console.error('Failed to insert toh visibility rule:', e);
    }
  }, [toh]);
};
